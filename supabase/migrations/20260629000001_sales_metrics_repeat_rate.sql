-- 売上区分 (サブスク/単発/回数券) の可視化 + 媒体別・スタッフ別リピート率 + 数値バグ修正
--
-- 背景:
--  1. Square Webhook が payment.* ごとに cashbook_entries を INSERT しており、
--     square_payment_id に一意制約が無いため再送・payment.created/updated で二重計上していた。
--  2. サブスク課金と単発・回数券売上が出納帳上で区別できなかった。
--  3. 日報のリピートは媒体内訳のない単一カウントのみで、媒体別リピート率を出せなかった。
--  4. member_stats.total_spend が visits × member_subscriptions の JOIN で水増しされていた。
--  5. attendance_daily / ticket_overview が UTC 日付基準で JST 深夜にズレていた。
--  6. visits テーブルに何も書き込まれず「最近の来店」が常に空だった。

-- =====================================================
-- 1. 出納帳: Square 決済の二重計上を防止 + 売上区分カラム
-- =====================================================

-- 1a. 既存の重複 Square 決済を 1 件に集約してから一意制約を張る
delete from public.cashbook_entries a
using public.cashbook_entries b
where a.square_payment_id is not null
  and a.square_payment_id = b.square_payment_id
  and a.ctid > b.ctid;

-- 非部分ユニークインデックス。NULL は一意制約上「相異なる」扱いのため手動入力 (square_payment_id 無し)
-- は複数行を許容しつつ、PostgREST の upsert (ON CONFLICT (square_payment_id)) が推論できる。
-- ※ 部分インデックス (where ... is not null) にすると PostgREST が WHERE 述語を付けないため
--    ON CONFLICT が一致せず実行時エラーになる。
create unique index if not exists cashbook_square_payment_uidx
  on public.cashbook_entries (square_payment_id);

-- 1b. 売上区分 (サブスク / 単発 / 回数券 / 物販 / その他) + Square 由来 ID
alter table public.cashbook_entries add column if not exists sale_kind text;
alter table public.cashbook_entries add column if not exists square_order_id text;
alter table public.cashbook_entries add column if not exists square_subscription_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cashbook_sale_kind_chk'
  ) then
    alter table public.cashbook_entries
      add constraint cashbook_sale_kind_chk
      check (sale_kind is null or sale_kind in ('subscription', 'single', 'ticket', 'product', 'other'))
      not valid;
  end if;
end$$;

create index if not exists cashbook_sale_kind_idx on public.cashbook_entries(sale_kind);

-- 既存行のベストエフォート分類 (カテゴリ名から推定)
update public.cashbook_entries set sale_kind = 'subscription'
  where sale_kind is null and entry_type = 'income' and category = 'サブスク売上';
update public.cashbook_entries set sale_kind = 'ticket'
  where sale_kind is null and entry_type = 'income' and category in ('回数券販売', '回数券売上');
update public.cashbook_entries set sale_kind = 'product'
  where sale_kind is null and entry_type = 'income' and category = '物販売上';

-- =====================================================
-- 2. 日報: 媒体別の既存施術件数 / リピート件数 + 整合性 CHECK
-- =====================================================
alter table public.daily_reports add column if not exists hpb_existing_count integer not null default 0;
alter table public.daily_reports add column if not exists hpb_repeat_count integer not null default 0;
alter table public.daily_reports add column if not exists meta_existing_count integer not null default 0;
alter table public.daily_reports add column if not exists meta_repeat_count integer not null default 0;
alter table public.daily_reports add column if not exists minimo_existing_count integer not null default 0;
alter table public.daily_reports add column if not exists minimo_repeat_count integer not null default 0;
alter table public.daily_reports add column if not exists referral_existing_count integer not null default 0;
alter table public.daily_reports add column if not exists referral_repeat_count integer not null default 0;

-- 既存データを壊さないため NOT VALID (以後の INSERT/UPDATE のみ検証)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'daily_reports_repeat_le_existing') then
    alter table public.daily_reports
      add constraint daily_reports_repeat_le_existing
      check (repeat_count <= existing_treatment_count) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'daily_reports_media_repeat_le_existing') then
    alter table public.daily_reports
      add constraint daily_reports_media_repeat_le_existing
      check (
        hpb_repeat_count <= hpb_existing_count
        and meta_repeat_count <= meta_existing_count
        and minimo_repeat_count <= minimo_existing_count
        and referral_repeat_count <= referral_existing_count
      ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'daily_reports_media_within_total') then
    alter table public.daily_reports
      add constraint daily_reports_media_within_total
      check (
        hpb_existing_count + meta_existing_count + minimo_existing_count + referral_existing_count <= existing_treatment_count
        and hpb_repeat_count + meta_repeat_count + minimo_repeat_count + referral_repeat_count <= repeat_count
      ) not valid;
  end if;
end$$;

-- =====================================================
-- 3. 会員: 獲得媒体 (派生リピート率の集計軸)
-- =====================================================
alter table public.members add column if not exists acquisition_channel text;
create index if not exists members_acq_channel_idx on public.members(acquisition_channel);

-- カウンセリング記録の最新 acquisition_channel から補完
update public.members m
set acquisition_channel = sub.acquisition_channel
from (
  select distinct on (member_id) member_id, acquisition_channel
  from public.counseling_records
  where member_id is not null and acquisition_channel is not null
  order by member_id, submitted_at desc
) sub
where sub.member_id = m.id and m.acquisition_channel is null;

-- =====================================================
-- 4. visits を施術レポートから自動投入 (リピート率の派生計算 + 最近の来店)
-- =====================================================
-- 施術レポート 1 件につき visits 1 行を維持する。treatment_report_id で重複防止。
alter table public.visits add column if not exists treatment_report_id uuid
  references public.treatment_reports(id) on delete cascade;
create unique index if not exists visits_treatment_report_uidx
  on public.visits(treatment_report_id);

create or replace function public.tg_sync_visit_from_treatment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.visits (
    member_id, store_id, staff_id, visit_date, visit_at,
    is_first_visit, menu, amount, treatment_report_id
  )
  values (
    new.member_id, new.store_id, new.staff_id, new.treatment_date,
    coalesce(new.created_at, now()),
    coalesce(new.is_first_visit, false), new.menu, new.amount, new.id
  )
  on conflict (treatment_report_id) do update set
    member_id = excluded.member_id,
    store_id = excluded.store_id,
    staff_id = excluded.staff_id,
    visit_date = excluded.visit_date,
    is_first_visit = excluded.is_first_visit,
    menu = excluded.menu,
    amount = excluded.amount;
  return new;
end;
$$;

drop trigger if exists sync_visit_after_treatment on public.treatment_reports;
create trigger sync_visit_after_treatment
  after insert or update on public.treatment_reports
  for each row execute function public.tg_sync_visit_from_treatment();

-- 既存の施術レポートを backfill
insert into public.visits (
  member_id, store_id, staff_id, visit_date, visit_at,
  is_first_visit, menu, amount, treatment_report_id
)
select tr.member_id, tr.store_id, tr.staff_id, tr.treatment_date,
       coalesce(tr.created_at, now()), coalesce(tr.is_first_visit, false),
       tr.menu, tr.amount, tr.id
from public.treatment_reports tr
where not exists (select 1 from public.visits v where v.treatment_report_id = tr.id);

-- =====================================================
-- 5. member_stats: JOIN ファンアウトを排除 (相関サブクエリ化)
-- =====================================================
-- 旧定義は visits と member_subscriptions を同時 JOIN して sum(v.amount) し、
-- 複数サブスクを持つ会員で来店金額が水増しされていた。
-- visits は施術レポートから自動投入されるため total_spend は visits のみで算出する
-- (treatment_reports.amount を二重加算しない)。
create or replace view public.member_stats as
select
  m.id as member_id,
  (select count(*) from public.visits v where v.member_id = m.id) as total_visits,
  (select max(v.visit_date) from public.visits v where v.member_id = m.id) as last_visit_date,
  coalesce((select sum(v.amount) from public.visits v where v.member_id = m.id), 0) as total_spend,
  (select count(*) from public.member_subscriptions ms
     where ms.member_id = m.id and ms.status in ('ACTIVE', 'active')) as active_subscriptions
from public.members m;

grant select on public.member_stats to authenticated;

-- =====================================================
-- 6. attendance_daily: JST 基準で日付バケット化
-- =====================================================
create or replace view public.attendance_daily as
with paired as (
  select
    staff_id,
    store_id,
    (clocked_at at time zone 'Asia/Tokyo')::date as work_date,
    min(clocked_at) filter (where kind = 'clock_in') as clock_in_at,
    max(clocked_at) filter (where kind = 'clock_out') as clock_out_at,
    count(*) filter (where kind = 'break_start') as break_starts,
    count(*) filter (where kind = 'break_end') as break_ends
  from public.attendance_logs
  group by staff_id, store_id, (clocked_at at time zone 'Asia/Tokyo')::date
)
select
  staff_id,
  store_id,
  work_date,
  clock_in_at,
  clock_out_at,
  case
    when clock_in_at is not null and clock_out_at is not null
    then extract(epoch from (clock_out_at - clock_in_at)) / 60
    else null
  end as gross_minutes,
  break_starts,
  break_ends
from paired;

grant select on public.attendance_daily to authenticated;

-- =====================================================
-- 7. ticket_overview / use_ticket: JST 基準で期限判定
-- =====================================================
create or replace view public.ticket_overview as
select
  t.*,
  m.full_name as member_name,
  m.line_user_id,
  m.line_picture_url,
  s.name as store_name,
  (t.total_count - t.used_count) as remaining_count,
  (t.expires_at - (now() at time zone 'Asia/Tokyo')::date) as days_until_expiry,
  case
    when t.status = 'refunded' then 'refunded'
    when t.used_count >= t.total_count then 'used_up'
    when t.expires_at < (now() at time zone 'Asia/Tokyo')::date then 'expired'
    else 'active'
  end as effective_status
from public.tickets t
left join public.members m on m.id = t.member_id
left join public.stores s on s.id = t.store_id;

grant select on public.ticket_overview to authenticated;

create or replace function public.use_ticket(
  p_ticket_id uuid,
  p_staff_id uuid default null,
  p_treatment_report_id uuid default null,
  p_menu text default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.tickets;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if v_ticket.id is null then
    return json_build_object('ok', false, 'error', 'ticket not found');
  end if;
  if v_ticket.status = 'refunded' then
    return json_build_object('ok', false, 'error', 'refunded ticket');
  end if;
  if v_ticket.used_count >= v_ticket.total_count then
    return json_build_object('ok', false, 'error', 'already used up');
  end if;
  if v_ticket.expires_at < v_today then
    return json_build_object('ok', false, 'error', 'expired');
  end if;

  update public.tickets
    set used_count = used_count + 1,
        status = case when used_count + 1 >= total_count then 'used_up' else status end
    where id = p_ticket_id;

  insert into public.ticket_usages (ticket_id, used_by_staff, treatment_report_id, menu, notes)
    values (p_ticket_id, p_staff_id, p_treatment_report_id, p_menu, p_notes);

  return json_build_object(
    'ok', true,
    'ticket_id', p_ticket_id,
    'remaining', v_ticket.total_count - v_ticket.used_count - 1
  );
end;
$$;

grant execute on function public.use_ticket(uuid, uuid, uuid, text, text) to authenticated;

-- =====================================================
-- 8. 派生リピート率ビュー (媒体別) — 会員の獲得媒体 × 来店履歴ベース
-- =====================================================
-- 日報の手動集計とは別軸の参考値。is_first_visit=false を「再来 (リピート)」とみなす。
create or replace view public.repeat_rate_by_media_derived as
select
  coalesce(nullif(trim(m.acquisition_channel), ''), '未設定') as channel,
  to_char(v.visit_date, 'YYYY-MM') as month,
  count(*) as total_visits,
  count(*) filter (where v.is_first_visit) as first_visits,
  count(*) filter (where not v.is_first_visit) as repeat_visits,
  case
    when count(*) > 0 then round(
      count(*) filter (where not v.is_first_visit)::numeric / count(*)::numeric * 100, 1
    )
    else 0
  end as repeat_rate
from public.visits v
left join public.members m on m.id = v.member_id
group by 1, 2;

grant select on public.repeat_rate_by_media_derived to authenticated;

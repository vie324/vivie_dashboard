-- UX 改善のための追加スキーマ
--
-- 含まれるもの:
-- 1. 会員タグ (member_tags + tags master)
-- 2. LINE メッセージテンプレート
-- 3. 出納帳カテゴリマスタ
-- 4. 監査ログ (audit_logs)
-- 5. メニュー / 価格マスタ
-- 6. 店舗営業時間
-- 7. 会員集計用ビュー (LTV / 最終来店 / 来店回数)
-- 8. 勤怠ペアビュー (出勤↔退勤)

-- ====== 1. タグ ======
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'rose', -- rose / amber / green / blue / violet / red
  created_at timestamptz not null default now()
);

create table if not exists public.member_tags (
  member_id uuid not null references public.members(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (member_id, tag_id)
);
create index if not exists member_tags_tag_idx on public.member_tags(tag_id);

alter table public.tags enable row level security;
alter table public.member_tags enable row level security;
create policy "auth all tags" on public.tags
  for all to authenticated using (true) with check (true);
create policy "auth all member_tags" on public.member_tags
  for all to authenticated using (true) with check (true);

-- 初期タグ
insert into public.tags (name, color) values
  ('VIP', 'amber'),
  ('要注意', 'red'),
  ('紹介者', 'green'),
  ('リピーター', 'rose')
on conflict (name) do nothing;

-- ====== 2. LINE メッセージテンプレート ======
create table if not exists public.line_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  category text default 'general',
  shortcut text,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.line_templates
  for each row execute function public.tg_set_updated_at();

alter table public.line_templates enable row level security;
create policy "auth all line_templates" on public.line_templates
  for all to authenticated using (true) with check (true);

-- 初期テンプレート
insert into public.line_templates (name, body, category) values
  ('予約確認', '{name}様、ご予約ありがとうございます。\n\n日時: \n店舗: \n\nお気をつけてご来店ください 🌸', 'reservation'),
  ('お礼メッセージ', '{name}様、本日はご来店いただきありがとうございました。\n\n施術後の経過で気になることがございましたらお気軽にご連絡ください。\n\n次回のご来店もお待ちしております 🌷', 'thanks'),
  ('リマインド', '{name}様、いつもありがとうございます。\nそろそろお肌のメンテナンス時期となりました。\nぜひご予約をお待ちしております ✨', 'reminder')
on conflict do nothing;

-- ====== 3. 出納帳カテゴリマスタ ======
create table if not exists public.cashbook_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entry_type text not null check (entry_type in ('income', 'expense', 'both')),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (name)
);

alter table public.cashbook_categories enable row level security;
create policy "auth all cashbook_categories" on public.cashbook_categories
  for all to authenticated using (true) with check (true);

insert into public.cashbook_categories (name, entry_type, display_order) values
  ('施術売上', 'income', 1),
  ('物販売上', 'income', 2),
  ('サブスク売上', 'income', 3),
  ('その他収入', 'income', 9),
  ('仕入れ', 'expense', 11),
  ('家賃', 'expense', 12),
  ('光熱費', 'expense', 13),
  ('広告費', 'expense', 14),
  ('給与', 'expense', 15),
  ('消耗品', 'expense', 16),
  ('その他経費', 'expense', 19)
on conflict (name) do nothing;

-- ====== 4. 監査ログ ======
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.staff(id) on delete set null,
  actor_name text,
  action text not null,
  entity text,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity, entity_id);

alter table public.audit_logs enable row level security;
create policy "auth read audit_logs" on public.audit_logs
  for select to authenticated using (true);
create policy "auth insert audit_logs" on public.audit_logs
  for insert to authenticated with check (true);

-- ====== 5. メニュー / 価格マスタ ======
create table if not exists public.treatment_menus (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  duration_minutes integer,
  price integer,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.treatment_menus enable row level security;
create policy "auth all treatment_menus" on public.treatment_menus
  for all to authenticated using (true) with check (true);

-- ====== 6. 営業時間 (店舗) ======
alter table public.stores add column if not exists business_hours jsonb default '{}'::jsonb;
-- 例: { "mon": {"open": "10:00", "close": "20:00"}, "tue": {...}, "regular_holiday": ["sun"] }

-- ====== 7. 会員集計ビュー ======
create or replace view public.member_stats as
select
  m.id as member_id,
  count(distinct v.id) as total_visits,
  max(v.visit_date) as last_visit_date,
  coalesce(sum(v.amount), 0)
    + coalesce((select sum(amount) from public.treatment_reports tr where tr.member_id = m.id), 0)
    as total_spend,
  count(distinct ms.id) filter (where ms.status in ('ACTIVE', 'active')) as active_subscriptions
from public.members m
left join public.visits v on v.member_id = m.id
left join public.member_subscriptions ms on ms.member_id = m.id
group by m.id;

grant select on public.member_stats to authenticated;

-- ====== 8. 勤怠ペアビュー (1日 1ペアの出勤/退勤) ======
create or replace view public.attendance_daily as
with paired as (
  select
    staff_id,
    store_id,
    date_trunc('day', clocked_at) as work_date,
    min(clocked_at) filter (where kind = 'clock_in') as clock_in_at,
    max(clocked_at) filter (where kind = 'clock_out') as clock_out_at,
    count(*) filter (where kind = 'break_start') as break_starts,
    count(*) filter (where kind = 'break_end') as break_ends
  from public.attendance_logs
  group by staff_id, store_id, date_trunc('day', clocked_at)
)
select
  staff_id,
  store_id,
  work_date::date as work_date,
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

-- treatment_reports と daily_reports は既に edit policy あり (auth all)

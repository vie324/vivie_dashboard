-- 決済ベース売上トラッキングの強化
--
--  1. サブスクプランに課金周期 (cadence) を追加。
--     Square の VARIATION は週次・年次などのプランがあり、月額換算しないと
--     MRR (月次経常収益) が過大/過小になる。
--  2. 売上集計・解約分析で使うインデックス。

alter table public.subscription_plans add column if not exists cadence text;

create index if not exists cashbook_type_date_idx
  on public.cashbook_entries(entry_type, entry_date);
create index if not exists member_subs_status_idx
  on public.member_subscriptions(status);
create index if not exists member_subs_started_idx
  on public.member_subscriptions(started_at);
create index if not exists member_subs_cancelled_idx
  on public.member_subscriptions(cancelled_at);

-- =====================================================
-- 全店舗目標 (store_id IS NULL) の重複防止
-- =====================================================
-- Postgres の UNIQUE は NULL 同士を「相異なる」と見なすため、全店舗目標を
-- 2 回保存すると行が増えて目標がランダムに切り替わっていた。
-- 最新 (updated_at が最大) の行だけ残して NULLS NOT DISTINCT で一意化する。
delete from public.monthly_goals a
using public.monthly_goals b
where a.store_id is null
  and b.store_id is null
  and a.goal_month = b.goal_month
  and (a.updated_at < b.updated_at
       or (a.updated_at = b.updated_at and a.ctid < b.ctid));

alter table public.monthly_goals
  drop constraint if exists monthly_goals_store_id_goal_month_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'monthly_goals_store_month_uq'
  ) then
    alter table public.monthly_goals
      add constraint monthly_goals_store_month_uq
      unique nulls not distinct (store_id, goal_month);
  end if;
end$$;

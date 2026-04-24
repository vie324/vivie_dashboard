-- ================================================================
-- 006: 日報 (daily reports)
-- ================================================================

create table if not exists daily_reports (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  store_id text not null references stores(id),
  -- チャネル別 新規/契約数
  channels jsonb not null default '{}'::jsonb,  -- { hpb: {new: 3, contract: 2}, meta: {...}, ... }
  -- 施術数
  treatment_count int default 0,
  -- 割引・コメント
  discount_amount int default 0,
  memo text,
  -- 記入者
  recorded_by text,
  -- 元データの raw (バックフィル時の追跡用)
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(date, store_id)
);

create index if not exists daily_reports_date_idx on daily_reports(date desc);
create index if not exists daily_reports_store_idx on daily_reports(store_id);

drop trigger if exists daily_reports_updated_at on daily_reports;
create trigger daily_reports_updated_at before update on daily_reports
  for each row execute function set_updated_at();

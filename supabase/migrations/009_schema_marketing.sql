-- ================================================================
-- 009: マーケティング (HPB / Meta / TikTok)
-- ================================================================

create table if not exists hpb_monthly (
  id uuid primary key default gen_random_uuid(),
  store_id text references stores(id),
  year_month text not null,             -- 'YYYY-MM'
  revenue int,
  visit_count int,
  new_customer_count int,
  avg_unit_price int,
  coupon_data jsonb,                    -- 詳細
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id, year_month)
);

create index if not exists hpb_monthly_ym_idx on hpb_monthly(year_month desc);

drop trigger if exists hpb_monthly_updated_at on hpb_monthly;
create trigger hpb_monthly_updated_at before update on hpb_monthly
  for each row execute function set_updated_at();

create table if not exists ads_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('meta','tiktok')),
  account_id text not null,
  account_name text,
  store_id text references stores(id),
  config jsonb,                         -- アクセストークンなどは Vercel 側。ここにはメタデータのみ
  active boolean default true,
  created_at timestamptz default now(),
  unique(provider, account_id)
);

create table if not exists ads_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ads_accounts(id) on delete cascade,
  date date not null,
  reach int,
  impressions int,
  clicks int,
  conversions int,
  spend_yen int,
  raw jsonb,
  created_at timestamptz default now(),
  unique(account_id, date)
);

create index if not exists ads_daily_metrics_date_idx on ads_daily_metrics(date desc);

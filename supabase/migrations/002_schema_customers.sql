-- ================================================================
-- 002: 顧客・会員 (customers, manual_memberships, member_usage)
-- ================================================================

-- =============== customers ===============
-- Square 会員・手動会員・カウンセリング顧客を統合した顧客マスタ
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  square_customer_id text unique,       -- Square 連携時のみ
  line_user_id text unique,             -- LIFF 経由で取得
  name text,
  name_kana text,
  phone text,
  email text,
  birth_date date,
  gender text,                          -- 'female' | 'male' | 'other' | null
  store_id text references stores(id) on delete set null,
  source text,                          -- 'square' | 'manual' | 'counseling' | 'line' | 'import'
  status text default 'active' check (status in ('active','inactive')),
  consent_given_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists customers_store_idx on customers(store_id);
create index if not exists customers_line_user_idx on customers(line_user_id) where line_user_id is not null;
create index if not exists customers_square_idx on customers(square_customer_id) where square_customer_id is not null;
create index if not exists customers_status_idx on customers(status);

drop trigger if exists customers_updated_at on customers;
create trigger customers_updated_at before update on customers
  for each row execute function set_updated_at();

-- =============== manual_memberships ===============
-- QR・現金払いの手動会員の拡張情報 (Square 会員にはこの行は作らない)
create table if not exists manual_memberships (
  customer_id uuid primary key references customers(id) on delete cascade,
  payment_method text check (payment_method in ('QR','CASH','OTHER')),
  plan_name text,
  monthly_price int,
  start_date date,
  canceled_date date,
  history jsonb not null default '[]'::jsonb,  -- [{date, action, note}, ...]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists manual_memberships_updated_at on manual_memberships;
create trigger manual_memberships_updated_at before update on manual_memberships
  for each row execute function set_updated_at();

-- =============== member_usage ===============
-- 期間ベースの利用回数管理 (サブスク請求期間)
create table if not exists member_usage (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  period_key text not null,             -- 期間開始日 YYYY-MM-DD
  usage_count int not null default 0,
  plan_limit int,
  carryover_count int not null default 0,
  updated_at timestamptz default now(),
  unique(customer_id, period_key)
);

create index if not exists member_usage_customer_idx on member_usage(customer_id);

drop trigger if exists member_usage_updated_at on member_usage;
create trigger member_usage_updated_at before update on member_usage
  for each row execute function set_updated_at();

-- =============== plan_limits ===============
-- プラン名 → 月間上限のマッピング (従来 dashboard_config に入っていたもの)
create table if not exists plan_limits (
  plan_name text primary key,
  monthly_limit int not null,
  updated_at timestamptz default now()
);

drop trigger if exists plan_limits_updated_at on plan_limits;
create trigger plan_limits_updated_at before update on plan_limits
  for each row execute function set_updated_at();

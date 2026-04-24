-- ================================================================
-- 004: 出納帳 (cashbook entries + daily closes + audit logs)
-- ================================================================

create table if not exists cashbook_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  store_id text references stores(id),
  type text not null check (type in ('income','expense')),
  category text,                        -- 施術売上 | サブスク月額 | 回数券販売 | 物販 | 他
  description text,
  amount int not null,                  -- 円
  customer_name text,                   -- スナップショット (後から顧客削除されても残す)
  treatment_count int default 0,
  payment_method text,                  -- 'CASH' | 'CARD' | 'QR' | 'SUBSCRIPTION' | ...
  cash_type text,                       -- 'register' | 'safe' | 'transfer' ...
  member_id uuid references customers(id) on delete set null,
  recorder text,                        -- staff.name スナップショット
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists cashbook_entries_date_idx on cashbook_entries(date desc);
create index if not exists cashbook_entries_store_idx on cashbook_entries(store_id);
create index if not exists cashbook_entries_member_idx on cashbook_entries(member_id);
create index if not exists cashbook_entries_category_idx on cashbook_entries(category);

drop trigger if exists cashbook_entries_updated_at on cashbook_entries;
create trigger cashbook_entries_updated_at before update on cashbook_entries
  for each row execute function set_updated_at();

-- =============== cashbook_daily_closes ===============
create table if not exists cashbook_daily_closes (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  store_id text not null references stores(id),
  locked boolean default true,
  register_balance int,                 -- レジ実績金額
  expected_balance int,                 -- 帳簿上の期待額
  discrepancy int,                      -- 差分 (register - expected)
  closed_by text,
  closed_at timestamptz default now(),
  unlocked_at timestamptz,
  unlocked_by text,
  unlock_reason text,
  unique(date, store_id)
);

create index if not exists cashbook_daily_closes_date_idx on cashbook_daily_closes(date desc);

-- =============== cashbook_audit_logs ===============
create table if not exists cashbook_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  operator text,
  action text not null,                 -- 'add'|'update'|'delete'|'close'|'unlock'
  target_type text,                     -- 'entry'|'close'
  target_id uuid,
  before_snapshot jsonb,
  after_snapshot jsonb,
  store_id text
);

create index if not exists cashbook_audit_logs_created_idx on cashbook_audit_logs(created_at desc);
create index if not exists cashbook_audit_logs_target_idx on cashbook_audit_logs(target_type, target_id);

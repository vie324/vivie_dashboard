-- ================================================================
-- 005: 回数券 (plans + customer tickets + usage log)
-- ================================================================

create table if not exists ticket_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sessions int not null,                -- 総回数
  price int not null,                   -- 円
  validity_days int,                    -- nullの場合は無期限
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists ticket_plans_updated_at on ticket_plans;
create trigger ticket_plans_updated_at before update on ticket_plans
  for each row execute function set_updated_at();

create table if not exists customer_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  plan_id uuid references ticket_plans(id) on delete set null,
  plan_name_snapshot text,              -- プラン削除後も名前を保持
  total_sessions int not null,
  remaining_sessions int not null,
  price_paid int,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,
  status text default 'active' check (status in ('active','consumed','expired','canceled')),
  store_id text references stores(id),
  history jsonb not null default '[]'::jsonb,  -- 消化履歴
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists customer_tickets_customer_idx on customer_tickets(customer_id);
create index if not exists customer_tickets_status_idx on customer_tickets(status);
create index if not exists customer_tickets_expires_idx on customer_tickets(expires_at) where expires_at is not null;

drop trigger if exists customer_tickets_updated_at on customer_tickets;
create trigger customer_tickets_updated_at before update on customer_tickets
  for each row execute function set_updated_at();

-- 消化明細 (history の jsonb に加えて正規化した履歴も用意: レポート時に便利)
create table if not exists ticket_usage_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references customer_tickets(id) on delete cascade,
  used_at timestamptz default now(),
  sessions_used int not null default 1,
  recorder text,
  notes text
);

create index if not exists ticket_usage_events_ticket_idx on ticket_usage_events(ticket_id);
create index if not exists ticket_usage_events_used_at_idx on ticket_usage_events(used_at desc);

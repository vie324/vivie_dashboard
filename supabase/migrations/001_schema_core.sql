-- ================================================================
-- 001: コアマスタ (staff, stores, dashboard_config)
-- ================================================================

create extension if not exists "pgcrypto";

-- =============== stores ===============
create table if not exists stores (
  id text primary key,                  -- Square location_id
  name text not null,
  short_name text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============== staff ===============
-- 既存のカスタム認証 (PBKDF2 + pepper) をそのまま載せる。
-- Phase D で Supabase Auth に置き換える場合はこのテーブルを廃止。
create table if not exists staff (
  id text primary key,                  -- 既存ID互換
  name text not null,
  role text not null check (role in ('headquarter','manager','staff')),
  store_ids text[] not null default '{}',
  -- カスタム認証情報 (Phase 1 で GAS に載っていたもの)
  password_salt text,
  password_auth_key text,
  password_algo text,
  password_iter int,
  status text default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists staff_status_idx on staff(status);

-- =============== dashboard_config ===============
create table if not exists dashboard_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- =============== 共通トリガ: updated_at 自動更新 ===============
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists stores_updated_at on stores;
create trigger stores_updated_at before update on stores
  for each row execute function set_updated_at();

drop trigger if exists staff_updated_at on staff;
create trigger staff_updated_at before update on staff
  for each row execute function set_updated_at();

drop trigger if exists dashboard_config_updated_at on dashboard_config;
create trigger dashboard_config_updated_at before update on dashboard_config
  for each row execute function set_updated_at();

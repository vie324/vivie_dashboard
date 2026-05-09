-- Vivie Dashboard 初期スキーマ
-- 認証は Supabase Auth (auth.users) を使用
-- スタッフ・店舗・会員・カウンセリング・出納帳・日報・勤怠を管理

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- =====================================================
-- 店舗
-- =====================================================
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  radius_meters integer not null default 300,
  square_location_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================
-- スタッフ (auth.users と 1:1)
-- =====================================================
create type public.staff_role as enum ('admin', 'manager', 'staff');

create table public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null unique,
  role public.staff_role not null default 'staff',
  primary_store_id uuid references public.stores(id) on delete set null,
  daily_report_token text unique default replace(gen_random_uuid()::text, '-', ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_role_idx on public.staff(role);
create index staff_token_idx on public.staff(daily_report_token);

-- スタッフが所属する店舗 (多対多)
create table public.staff_stores (
  staff_id uuid not null references public.staff(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  primary key (staff_id, store_id)
);

-- =====================================================
-- 会員
-- =====================================================
create type public.member_source as enum ('square', 'manual');
create type public.member_status as enum ('active', 'paused', 'cancelled', 'lead');

create table public.members (
  id uuid primary key default gen_random_uuid(),
  source public.member_source not null default 'manual',
  square_customer_id text unique,
  full_name text not null,
  furigana text,
  email text,
  phone text,
  birth_date date,
  address text,
  occupation text,
  status public.member_status not null default 'active',
  primary_store_id uuid references public.stores(id) on delete set null,
  notes text,
  joined_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index members_status_idx on public.members(status);
create index members_store_idx on public.members(primary_store_id);
create index members_phone_idx on public.members(phone);
create index members_square_idx on public.members(square_customer_id);

-- =====================================================
-- サブスクプラン (Square Catalog のキャッシュ + 内部上限管理)
-- =====================================================
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  square_plan_id text unique,
  name text not null,
  monthly_price integer not null default 0,
  monthly_visit_limit integer,
  carryover_months integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 会員のサブスク状況 (Square Subscription を反映)
create table public.member_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  square_subscription_id text unique,
  status text not null,
  started_at date,
  next_billing_at date,
  cancelled_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index member_subs_member_idx on public.member_subscriptions(member_id);

-- =====================================================
-- 来店履歴 (リピート率の計算に使用)
-- =====================================================
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete set null,
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  visit_date date not null,
  visit_at timestamptz not null default now(),
  is_first_visit boolean not null default false,
  menu text,
  amount integer,
  notes text,
  created_at timestamptz not null default now()
);

create index visits_member_idx on public.visits(member_id);
create index visits_date_idx on public.visits(visit_date);
create index visits_store_idx on public.visits(store_id);

-- =====================================================
-- カウンセリング (Google Form から置き換え)
-- =====================================================
create table public.counseling_records (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  member_id uuid references public.members(id) on delete set null,
  -- 基本情報
  full_name text not null,
  furigana text,
  address text,
  phone text not null,
  birth_date date,
  occupation text,
  -- 来店動機 (multi-select)
  visit_reasons text[] not null default '{}',
  visit_reason_other text,
  -- 他店受けた施術
  past_treatments text[] not null default '{}',
  -- 乗り換え理由
  switch_reason text,
  switch_reason_other text,
  -- 不満点
  past_complaints text[] not null default '{}',
  past_complaints_other text,
  -- 悩み
  skin_concerns text[] not null default '{}',
  face_concerns text[] not null default '{}',
  body_concerns text[] not null default '{}',
  -- 目標と予算
  goal_timeline text,
  monthly_budget text,
  -- 同意
  agreed_to_terms boolean not null default false,
  -- メタ
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.staff(id) on delete set null,
  reviewed_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now()
);

create index counseling_store_idx on public.counseling_records(store_id);
create index counseling_member_idx on public.counseling_records(member_id);
create index counseling_submitted_idx on public.counseling_records(submitted_at desc);

-- =====================================================
-- 出納帳
-- =====================================================
create type public.cashbook_type as enum ('income', 'expense', 'adjustment');
create type public.cashbook_source as enum ('cash', 'square', 'bank', 'online', 'other');

create table public.cashbook_entries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  entry_date date not null,
  entry_type public.cashbook_type not null,
  source public.cashbook_source not null default 'cash',
  category text not null,
  amount integer not null,
  description text,
  related_member_id uuid references public.members(id) on delete set null,
  square_payment_id text,
  recorded_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cashbook_store_date_idx on public.cashbook_entries(store_id, entry_date desc);
create index cashbook_type_idx on public.cashbook_entries(entry_type);

-- =====================================================
-- 日報 (スタッフがリピート率含めて入力)
-- =====================================================
create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  report_date date not null,
  -- 集客
  hpb_new_count integer not null default 0,
  hpb_contract_count integer not null default 0,
  meta_new_count integer not null default 0,
  meta_contract_count integer not null default 0,
  referral_new_count integer not null default 0,
  referral_contract_count integer not null default 0,
  -- 既存顧客
  existing_treatment_count integer not null default 0,
  repeat_count integer not null default 0,
  -- 売上
  total_sales integer not null default 0,
  discount_total integer not null default 0,
  -- 所感
  highlights text,
  challenges text,
  next_actions text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, staff_id, report_date)
);

create index daily_reports_store_date_idx on public.daily_reports(store_id, report_date desc);
create index daily_reports_staff_idx on public.daily_reports(staff_id);

-- =====================================================
-- 勤怠 (GPS 打刻)
-- =====================================================
create type public.attendance_kind as enum ('clock_in', 'clock_out', 'break_start', 'break_end');

create table public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  kind public.attendance_kind not null,
  clocked_at timestamptz not null default now(),
  latitude double precision not null,
  longitude double precision not null,
  distance_meters double precision not null,
  device_info jsonb,
  created_at timestamptz not null default now()
);

create index attendance_staff_date_idx on public.attendance_logs(staff_id, clocked_at desc);
create index attendance_store_idx on public.attendance_logs(store_id);

-- =====================================================
-- updated_at 自動更新トリガー
-- =====================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array['stores', 'staff', 'members', 'subscription_plans',
                       'member_subscriptions', 'cashbook_entries', 'daily_reports'])
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.tg_set_updated_at();', t);
  end loop;
end$$;

-- =====================================================
-- ヘルパー: 現在ユーザーのスタッフレコード
-- =====================================================
create or replace function public.current_staff()
returns public.staff
language sql stable as $$
  select * from public.staff where id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable as $$
  select coalesce((select role = 'admin' from public.staff where id = auth.uid()), false);
$$;

create or replace function public.is_admin_or_manager()
returns boolean
language sql stable as $$
  select coalesce(
    (select role in ('admin', 'manager') from public.staff where id = auth.uid()),
    false);
$$;

-- =====================================================
-- RLS 有効化
-- =====================================================
alter table public.stores enable row level security;
alter table public.staff enable row level security;
alter table public.staff_stores enable row level security;
alter table public.members enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.member_subscriptions enable row level security;
alter table public.visits enable row level security;
alter table public.counseling_records enable row level security;
alter table public.cashbook_entries enable row level security;
alter table public.daily_reports enable row level security;
alter table public.attendance_logs enable row level security;

-- 認証ユーザーは全テーブル read 可能 (店舗フィルタは UI 側)
create policy "auth read stores" on public.stores
  for select using (auth.role() = 'authenticated');
create policy "admin write stores" on public.stores
  for all using (public.is_admin()) with check (public.is_admin());

create policy "auth read staff" on public.staff
  for select using (auth.role() = 'authenticated');
create policy "self update staff" on public.staff
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admin write staff" on public.staff
  for all using (public.is_admin()) with check (public.is_admin());

create policy "auth read staff_stores" on public.staff_stores
  for select using (auth.role() = 'authenticated');
create policy "admin write staff_stores" on public.staff_stores
  for all using (public.is_admin()) with check (public.is_admin());

create policy "auth read members" on public.members
  for select using (auth.role() = 'authenticated');
create policy "auth write members" on public.members
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth read plans" on public.subscription_plans
  for select using (auth.role() = 'authenticated');
create policy "admin write plans" on public.subscription_plans
  for all using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

create policy "auth read member_subs" on public.member_subscriptions
  for select using (auth.role() = 'authenticated');
create policy "auth write member_subs" on public.member_subscriptions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth read visits" on public.visits
  for select using (auth.role() = 'authenticated');
create policy "auth write visits" on public.visits
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- カウンセリング: 公開フォームから anon で insert を許可
create policy "anon insert counseling" on public.counseling_records
  for insert with check (true);
create policy "auth read counseling" on public.counseling_records
  for select using (auth.role() = 'authenticated');
create policy "auth update counseling" on public.counseling_records
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
create policy "admin delete counseling" on public.counseling_records
  for delete using (public.is_admin_or_manager());

create policy "auth read cashbook" on public.cashbook_entries
  for select using (auth.role() = 'authenticated');
create policy "auth write cashbook" on public.cashbook_entries
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth read daily_reports" on public.daily_reports
  for select using (auth.role() = 'authenticated');
create policy "self insert daily_reports" on public.daily_reports
  for insert with check (staff_id = auth.uid() or public.is_admin_or_manager());
create policy "self update daily_reports" on public.daily_reports
  for update using (staff_id = auth.uid() or public.is_admin_or_manager())
  with check (staff_id = auth.uid() or public.is_admin_or_manager());
create policy "admin delete daily_reports" on public.daily_reports
  for delete using (public.is_admin_or_manager());

create policy "auth read attendance" on public.attendance_logs
  for select using (
    auth.role() = 'authenticated'
    and (staff_id = auth.uid() or public.is_admin_or_manager())
  );
create policy "self insert attendance" on public.attendance_logs
  for insert with check (staff_id = auth.uid());
create policy "admin delete attendance" on public.attendance_logs
  for delete using (public.is_admin());

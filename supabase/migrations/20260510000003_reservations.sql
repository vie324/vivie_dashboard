-- 予約管理
-- HPB / minimo / 電話 / 直接 / LINE / Instagram などの予約を統合管理
-- 公式 API がないため、CSV インポート + 手動入力 + (将来) メール解析で対応

do $$ begin
  create type public.reservation_source as enum (
    'hpb', 'minimo', 'phone', 'direct', 'line', 'instagram', 'threads', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reservation_status as enum (
    'pending', 'confirmed', 'completed', 'cancelled', 'no_show'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete set null,
  customer_name text not null,
  customer_furigana text,
  customer_phone text,
  customer_email text,
  source public.reservation_source not null default 'phone',
  source_label text,
  external_id text,
  reservation_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  menu text,
  amount integer,
  staff_id uuid references public.staff(id) on delete set null,
  store_id uuid not null references public.stores(id) on delete cascade,
  status public.reservation_status not null default 'confirmed',
  notes text,
  source_data jsonb,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.reservations
  for each row execute function public.tg_set_updated_at();

create index if not exists reservations_at_idx on public.reservations(reservation_at desc);
create index if not exists reservations_store_at_idx
  on public.reservations(store_id, reservation_at desc);
create index if not exists reservations_member_idx on public.reservations(member_id);
create index if not exists reservations_staff_idx on public.reservations(staff_id, reservation_at desc);
create index if not exists reservations_source_idx on public.reservations(source, reservation_at desc);
create unique index if not exists reservations_external_uidx
  on public.reservations(source, external_id) where external_id is not null;

alter table public.reservations enable row level security;
create policy "auth all reservations" on public.reservations
  for all to authenticated using (true) with check (true);

-- 終了時刻を計算して付与する一覧用ビュー
create or replace view public.reservation_overview as
select
  r.*,
  (r.reservation_at + (r.duration_minutes || ' minutes')::interval) as end_at,
  m.full_name as member_full_name,
  m.line_picture_url as member_picture,
  m.phone as member_phone,
  s.display_name as staff_name,
  st.name as store_name
from public.reservations r
left join public.members m on m.id = r.member_id
left join public.staff s on s.id = r.staff_id
left join public.stores st on st.id = r.store_id;

grant select on public.reservation_overview to authenticated;

-- 会員自動紐付けトリガー: 電話番号が既存会員と一致したら自動で member_id をセット
create or replace function public.tg_link_reservation_member()
returns trigger language plpgsql as $$
declare
  v_member_id uuid;
  v_norm_phone text;
begin
  if new.member_id is not null or new.customer_phone is null then
    return new;
  end if;
  -- 電話番号正規化 (数字のみ)
  v_norm_phone := regexp_replace(new.customer_phone, '[^0-9]', '', 'g');
  if length(v_norm_phone) < 9 then return new; end if;

  select id into v_member_id
  from public.members
  where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = v_norm_phone
  limit 1;

  if v_member_id is not null then
    new.member_id := v_member_id;
  end if;
  return new;
end;
$$;

drop trigger if exists link_reservation_member_trg on public.reservations;
create trigger link_reservation_member_trg
  before insert on public.reservations
  for each row execute function public.tg_link_reservation_member();

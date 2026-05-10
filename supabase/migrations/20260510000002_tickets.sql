-- 回数券 (チケット) 管理
-- 1. ticket_plans: 回数券マスタ (10回コース/15万円/有効6ヶ月 等)
-- 2. tickets: 発行されたチケット (会員ごと)
-- 3. ticket_usages: 1 回使用するごとの履歴
-- 4. ticket_summary view: 残数 / 期限 / 状態を動的に計算

create table if not exists public.ticket_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_count integer not null check (total_count > 0),
  price integer not null default 0,
  validity_months integer not null default 6 check (validity_months > 0),
  is_active boolean not null default true,
  display_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.ticket_plans
  for each row execute function public.tg_set_updated_at();

alter table public.ticket_plans enable row level security;
create policy "auth all ticket_plans" on public.ticket_plans
  for all to authenticated using (true) with check (true);

-- 初期マスタ
insert into public.ticket_plans (name, total_count, price, validity_months, display_order)
values
  ('5回券', 5, 50000, 6, 1),
  ('10回券', 10, 90000, 12, 2),
  ('20回券', 20, 160000, 12, 3)
on conflict do nothing;

-- 発行されたチケット
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  plan_id uuid references public.ticket_plans(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  -- スナップショット (プラン削除しても情報が残るように)
  plan_name text not null,
  total_count integer not null check (total_count > 0),
  used_count integer not null default 0 check (used_count >= 0),
  price integer not null default 0,
  purchased_at date not null default current_date,
  expires_at date not null,
  status text not null default 'active' check (status in ('active', 'used_up', 'expired', 'refunded')),
  notes text,
  sold_by uuid references public.staff(id) on delete set null,
  refunded_at timestamptz,
  refunded_by uuid references public.staff(id) on delete set null,
  refund_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.tickets
  for each row execute function public.tg_set_updated_at();

create index if not exists tickets_member_idx on public.tickets(member_id, expires_at desc);
create index if not exists tickets_status_idx on public.tickets(status, expires_at);
create index if not exists tickets_active_idx on public.tickets(member_id, status) where status = 'active';

alter table public.tickets enable row level security;
create policy "auth all tickets" on public.tickets
  for all to authenticated using (true) with check (true);

-- 使用ログ
create table if not exists public.ticket_usages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  used_at timestamptz not null default now(),
  used_by_staff uuid references public.staff(id) on delete set null,
  treatment_report_id uuid references public.treatment_reports(id) on delete set null,
  menu text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists ticket_usages_ticket_idx on public.ticket_usages(ticket_id, used_at desc);
create index if not exists ticket_usages_treatment_idx on public.ticket_usages(treatment_report_id);

alter table public.ticket_usages enable row level security;
create policy "auth all ticket_usages" on public.ticket_usages
  for all to authenticated using (true) with check (true);

-- 状態自動判定ビュー (used_up / expired を動的に計算)
create or replace view public.ticket_overview as
select
  t.*,
  m.full_name as member_name,
  m.line_user_id,
  m.line_picture_url,
  s.name as store_name,
  (t.total_count - t.used_count) as remaining_count,
  (t.expires_at - current_date) as days_until_expiry,
  case
    when t.status = 'refunded' then 'refunded'
    when t.used_count >= t.total_count then 'used_up'
    when t.expires_at < current_date then 'expired'
    else 'active'
  end as effective_status
from public.tickets t
left join public.members m on m.id = t.member_id
left join public.stores s on s.id = t.store_id;

grant select on public.ticket_overview to authenticated;

-- チケット使用 RPC (1 回消費して使用ログ作成)
create or replace function public.use_ticket(
  p_ticket_id uuid,
  p_staff_id uuid default null,
  p_treatment_report_id uuid default null,
  p_menu text default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.tickets;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if v_ticket.id is null then
    return json_build_object('ok', false, 'error', 'ticket not found');
  end if;
  if v_ticket.status = 'refunded' then
    return json_build_object('ok', false, 'error', 'refunded ticket');
  end if;
  if v_ticket.used_count >= v_ticket.total_count then
    return json_build_object('ok', false, 'error', 'already used up');
  end if;
  if v_ticket.expires_at < current_date then
    return json_build_object('ok', false, 'error', 'expired');
  end if;

  update public.tickets
    set used_count = used_count + 1,
        status = case when used_count + 1 >= total_count then 'used_up' else status end
    where id = p_ticket_id;

  insert into public.ticket_usages (ticket_id, used_by_staff, treatment_report_id, menu, notes)
    values (p_ticket_id, p_staff_id, p_treatment_report_id, p_menu, p_notes);

  return json_build_object(
    'ok', true,
    'ticket_id', p_ticket_id,
    'remaining', v_ticket.total_count - v_ticket.used_count - 1
  );
end;
$$;

grant execute on function public.use_ticket(uuid, uuid, uuid, text, text) to authenticated;

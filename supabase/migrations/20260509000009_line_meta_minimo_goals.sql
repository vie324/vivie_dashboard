-- LINE 会話の対応状況管理 + 日報に minimo 追加 + AI 設計用フィールド

-- 1) 会話メタ (会話単位の対応状況・ピン・担当者・メモ)
create table if not exists public.line_conversation_meta (
  line_user_id text primary key,
  status text not null default 'open' check (status in ('open', 'handled', 'archived')),
  pinned boolean not null default false,
  assignee_id uuid references public.staff(id) on delete set null,
  internal_notes text,
  last_handled_at timestamptz,
  last_handled_by uuid references public.staff(id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.line_conversation_meta
  for each row execute function public.tg_set_updated_at();

alter table public.line_conversation_meta enable row level security;
create policy "auth all line_conversation_meta" on public.line_conversation_meta
  for all to authenticated using (true) with check (true);

-- 2) 日報に minimo 追加
alter table public.daily_reports add column if not exists minimo_new_count integer not null default 0;
alter table public.daily_reports add column if not exists minimo_contract_count integer not null default 0;

-- 3) line_conversations ビューを meta と JOIN するよう更新
create or replace view public.line_conversations as
select distinct on (m.line_user_id)
  m.line_user_id,
  m.member_id,
  mb.full_name as member_name,
  mb.line_display_name,
  mb.line_picture_url,
  m.message_text as last_message,
  m.message_type as last_message_type,
  m.direction as last_direction,
  m.sent_at as last_sent_at,
  coalesce(meta.status, 'open') as status,
  coalesce(meta.pinned, false) as pinned,
  meta.assignee_id,
  meta.last_handled_at,
  (
    select count(*) from public.line_messages u
    where u.line_user_id = m.line_user_id
      and u.direction = 'inbound'
      and u.read_at is null
  ) as unread_count
from public.line_messages m
left join public.members mb on mb.id = m.member_id
left join public.line_conversation_meta meta on meta.line_user_id = m.line_user_id
where m.message_type != 'system' or true
order by m.line_user_id, m.sent_at desc;

grant select on public.line_conversations to authenticated;

-- 4) 目標管理用テーブル (AI 提案用 + 手動入力)
create table if not exists public.monthly_goals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  goal_month text not null, -- YYYY-MM
  hpb_new_target integer default 0,
  meta_new_target integer default 0,
  minimo_new_target integer default 0,
  referral_new_target integer default 0,
  contract_target integer default 0,
  sales_target integer default 0,
  repeat_rate_target integer default 0, -- 0-100
  notes text,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, goal_month)
);

create trigger set_updated_at before update on public.monthly_goals
  for each row execute function public.tg_set_updated_at();

alter table public.monthly_goals enable row level security;
create policy "auth all monthly_goals" on public.monthly_goals
  for all to authenticated using (true) with check (true);

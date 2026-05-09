-- LINE メッセージング: ダッシュボード上で双方向のやりとりを管理
-- inbound (LINE→Vivie) と outbound (Vivie→LINE) を一本のテーブルで管理

create table if not exists public.line_messages (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  member_id uuid references public.members(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text', -- text / image / sticker / flex / system
  message_text text,
  content jsonb,                              -- 非テキスト用のペイロード
  line_message_id text,                       -- LINE プラットフォーム側の id
  sent_by uuid references public.staff(id) on delete set null,
  sent_at timestamptz not null default now(),
  read_at timestamptz,                        -- スタッフが読んだ時刻
  created_at timestamptz not null default now()
);

create index if not exists line_messages_user_sent_idx
  on public.line_messages(line_user_id, sent_at desc);
create index if not exists line_messages_member_idx on public.line_messages(member_id);
create index if not exists line_messages_unread_idx
  on public.line_messages(line_user_id) where read_at is null and direction = 'inbound';

alter table public.line_messages enable row level security;
create policy "auth all line_messages" on public.line_messages
  for all to authenticated using (true) with check (true);

-- Realtime 対応 (Supabase Realtime で INSERT を購読)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'line_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.line_messages';
  end if;
exception when others then
  -- publication が無い環境では無視 (Supabase 以外)
  null;
end$$;

-- ヘッダー (会話一覧用): 各 line_user_id の最新メッセージ
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
  (
    select count(*) from public.line_messages u
    where u.line_user_id = m.line_user_id
      and u.direction = 'inbound'
      and u.read_at is null
  ) as unread_count
from public.line_messages m
left join public.members mb on mb.id = m.member_id
order by m.line_user_id, m.sent_at desc;

grant select on public.line_conversations to authenticated;

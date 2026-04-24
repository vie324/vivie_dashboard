-- ================================================================
-- 007: LINE (threads + messages + templates + auto replies)
-- ================================================================

create table if not exists line_threads (
  user_id text primary key,             -- LINE userId (U...)
  customer_id uuid references customers(id) on delete set null,
  display_name text,
  picture_url text,
  tags text[] default '{}',
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int default 0,
  store_id text references stores(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists line_threads_last_msg_idx on line_threads(last_message_at desc);
create index if not exists line_threads_customer_idx on line_threads(customer_id);
create index if not exists line_threads_tags_idx on line_threads using gin(tags);

drop trigger if exists line_threads_updated_at on line_threads;
create trigger line_threads_updated_at before update on line_threads
  for each row execute function set_updated_at();

create table if not exists line_messages (
  id uuid primary key default gen_random_uuid(),
  thread_user_id text not null references line_threads(user_id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  message_type text not null,           -- 'text'|'flex'|'image'|'sticker'|'template'
  content jsonb not null,
  sent_by text,                         -- 送信者 (out の場合 staff.name スナップショット)
  sent_at timestamptz default now(),
  external_id text                      -- LINE の messageId (重複排除用)
);

create index if not exists line_messages_thread_idx on line_messages(thread_user_id, sent_at desc);
create index if not exists line_messages_external_idx on line_messages(external_id) where external_id is not null;

create table if not exists line_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  content jsonb not null,
  category text,                        -- 'welcome' | 'reminder' | 'promotion' | ...
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists line_templates_updated_at on line_templates;
create trigger line_templates_updated_at before update on line_templates
  for each row execute function set_updated_at();

create table if not exists line_auto_replies (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  match_type text default 'contains' check (match_type in ('exact','contains','regex')),
  reply_content jsonb not null,
  active boolean default true,
  priority int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists line_auto_replies_active_idx on line_auto_replies(active, priority desc);

drop trigger if exists line_auto_replies_updated_at on line_auto_replies;
create trigger line_auto_replies_updated_at before update on line_auto_replies
  for each row execute function set_updated_at();

create table if not exists line_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text,
  content jsonb not null,
  filter_tags text[] default '{}',
  target_count int,
  sent_at timestamptz,
  sent_by text,
  status text default 'draft' check (status in ('draft','scheduled','sent','failed')),
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

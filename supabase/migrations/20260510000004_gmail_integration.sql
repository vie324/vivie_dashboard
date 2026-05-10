-- Gmail プッシュ通知連携で予約自動取り込み

create table if not exists public.gmail_integration_settings (
  id text primary key default 'default',  -- 単一行 (default のみ)
  email_address text,
  refresh_token text,           -- Google OAuth refresh token
  history_id text,              -- 最後に処理した historyId
  watch_expiration timestamptz, -- Gmail watch の期限
  label_ids text[],             -- 監視するラベル (空なら受信箱全体)
  is_active boolean not null default false,
  last_received_at timestamptz,
  last_error text,
  connected_by uuid references public.staff(id) on delete set null,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.gmail_integration_settings
  for each row execute function public.tg_set_updated_at();

alter table public.gmail_integration_settings enable row level security;
create policy "auth all gmail_settings" on public.gmail_integration_settings
  for all to authenticated using (true) with check (true);

-- 受信メール処理ログ
create type public.inbound_email_status as enum (
  'received', 'parsed', 'matched', 'unmatched', 'duplicate', 'error'
);

create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  message_id text unique,        -- Gmail message id
  thread_id text,
  sender text,
  subject text,
  received_at timestamptz not null default now(),
  body_snippet text,
  body_text text,                -- 全文 (デバッグ用)
  parser_used text,              -- 'hpb' / 'minimo' / 'generic' / null
  parsed_data jsonb,
  status public.inbound_email_status not null default 'received',
  reservation_id uuid references public.reservations(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists inbound_emails_received_idx on public.inbound_emails(received_at desc);
create index if not exists inbound_emails_status_idx on public.inbound_emails(status, received_at desc);

alter table public.inbound_emails enable row level security;
create policy "auth all inbound_emails" on public.inbound_emails
  for all to authenticated using (true) with check (true);

-- LINE 連携 + 施術レポートのフォローアップ機能
--
-- 目的: 初回来店で契約に至らなかったお客様に、本日の施術成果と
-- 「もう 1 回だけお得に来店できる」オファーを LINE で送信する

-- 1) 会員に LINE userId を紐付け
alter table public.members add column if not exists line_user_id text;
alter table public.members add column if not exists line_display_name text;
alter table public.members add column if not exists line_picture_url text;
create unique index if not exists members_line_user_id_uidx
  on public.members(line_user_id) where line_user_id is not null;

-- 2) 施術レポート: フォローアップ用のフィールド
alter table public.treatment_reports add column if not exists is_first_visit boolean not null default false;
alter table public.treatment_reports add column if not exists contracted boolean not null default false;
alter table public.treatment_reports add column if not exists followup_offer jsonb;
-- followup_offer 例: {
--   "menu": "ハイドラフェイシャル",
--   "original_price": 12000,
--   "discounted_price": 5000,
--   "discount_label": "約60% OFF",
--   "expires_at": "2026-05-23",
--   "reservation_url": "https://...",
--   "notes": "初回特別価格。期間限定。"
-- }
alter table public.treatment_reports add column if not exists line_sent_at timestamptz;
alter table public.treatment_reports add column if not exists line_request_id text;
alter table public.treatment_reports add column if not exists line_send_status text;
alter table public.treatment_reports add column if not exists line_send_error text;

-- 3) LINE イベントログ (友だち追加 / メッセージ受信)
create table if not exists public.line_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  line_user_id text,
  display_name text,
  picture_url text,
  message_text text,
  raw jsonb,
  member_id uuid references public.members(id) on delete set null,
  received_at timestamptz not null default now()
);

create index if not exists line_events_user_idx on public.line_events(line_user_id);
create index if not exists line_events_received_idx on public.line_events(received_at desc);
create index if not exists line_events_member_idx on public.line_events(member_id);

alter table public.line_events enable row level security;
create policy "auth all line_events" on public.line_events
  for all to authenticated using (true) with check (true);

-- 4) 既存ポリシーが treatment_reports の新カラムを許可しているか念のため再定義
-- (auth all treatment_reports は既にあるはずなので no-op の場合 drop は無視)

-- ================================================================
-- 003: カウンセリング (フォーム定義 + 回答 + ドラフト)
-- ================================================================

-- =============== counseling_form_definitions ===============
-- フォーム構造をバージョン管理 (過去回答の互換性維持)
create table if not exists counseling_form_definitions (
  id uuid primary key default gen_random_uuid(),
  version int not null unique,
  title text not null,
  schema jsonb not null,                -- [{ id, type, label, options?, required?, conditional? }, ...]
  active boolean not null default false,
  created_at timestamptz default now(),
  activated_at timestamptz
);

create index if not exists counseling_form_active_idx on counseling_form_definitions(active) where active = true;

-- =============== counseling_responses ===============
create table if not exists counseling_responses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  store_id text references stores(id),
  form_version int not null,
  answers jsonb not null,               -- { questionId: value, ... }
  face_zone_marks jsonb,                -- { 'forehead': true, 'left_cheek': true, ... }
  attachment_paths text[] default '{}', -- Supabase Storage のパス配列
  source text,                          -- 'web' | 'liff' | 'qr' | 'import'
  line_user_id text,                    -- LIFF 由来の場合 (Customer 作成前に記録しておく)
  submitted_at timestamptz not null default now(),
  consent_given_at timestamptz not null,
  recommended_plan_key text,            -- CF_PLAN_CATALOG のキー (サーバ側で自動算出 or 空)
  staff_review_notes text,              -- スタッフの追記メモ
  status text default 'new' check (status in ('new','reviewed','converted','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists counseling_responses_customer_idx on counseling_responses(customer_id);
create index if not exists counseling_responses_store_idx on counseling_responses(store_id);
create index if not exists counseling_responses_line_idx on counseling_responses(line_user_id) where line_user_id is not null;
create index if not exists counseling_responses_submitted_idx on counseling_responses(submitted_at desc);
create index if not exists counseling_responses_status_idx on counseling_responses(status);

drop trigger if exists counseling_responses_updated_at on counseling_responses;
create trigger counseling_responses_updated_at before update on counseling_responses
  for each row execute function set_updated_at();

-- =============== counseling_drafts ===============
-- 顧客が途中離脱したときに再開できるよう一時保存する
-- 7日で自動削除
create table if not exists counseling_drafts (
  session_id uuid primary key default gen_random_uuid(),
  line_user_id text,                    -- あれば LIFF 経由
  store_id text,
  answers jsonb not null default '{}'::jsonb,
  face_zone_marks jsonb,
  updated_at timestamptz default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists counseling_drafts_expires_idx on counseling_drafts(expires_at);
create index if not exists counseling_drafts_line_idx on counseling_drafts(line_user_id) where line_user_id is not null;

drop trigger if exists counseling_drafts_updated_at on counseling_drafts;
create trigger counseling_drafts_updated_at before update on counseling_drafts
  for each row execute function set_updated_at();

-- 期限切れドラフトを削除するヘルパー (定期実行は Supabase の Cron で)
create or replace function purge_expired_counseling_drafts() returns void as $$
begin
  delete from counseling_drafts where expires_at < now();
end $$ language plpgsql;

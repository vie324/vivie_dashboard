-- ================================================================
-- 011: RLS (Row Level Security) ポリシー
-- ================================================================
-- Phase A〜C はカスタム認証 (index.html 側の PBKDF2+HMAC) のまま運用。
-- Supabase 側は anon key + このポリシーで最低限のアクセス制御を行う。
--
-- 重要な方針:
--   - 顧客向けカウンセリングフォーム: anon で INSERT 可能 (データ送信)
--   - スタッフ向けの読取/編集は anon key では行わず、Vercel API Routes 経由で
--     service_role key + カスタム認証を検証したうえで Supabase にアクセスする
--   - Phase D で Supabase Auth に切替後、このファイルを 012_rls_policies_auth.sql で上書き

-- すべてのテーブルで RLS を有効化
alter table stores                       enable row level security;
alter table staff                        enable row level security;
alter table dashboard_config             enable row level security;
alter table customers                    enable row level security;
alter table manual_memberships           enable row level security;
alter table member_usage                 enable row level security;
alter table plan_limits                  enable row level security;
alter table counseling_form_definitions  enable row level security;
alter table counseling_responses         enable row level security;
alter table counseling_drafts            enable row level security;
alter table cashbook_entries             enable row level security;
alter table cashbook_daily_closes        enable row level security;
alter table cashbook_audit_logs          enable row level security;
alter table ticket_plans                 enable row level security;
alter table customer_tickets             enable row level security;
alter table ticket_usage_events          enable row level security;
alter table daily_reports                enable row level security;
alter table line_threads                 enable row level security;
alter table line_messages                enable row level security;
alter table line_templates               enable row level security;
alter table line_auto_replies            enable row level security;
alter table line_broadcasts              enable row level security;
alter table treatment_reports            enable row level security;
alter table skin_analyses                enable row level security;
alter table hpb_monthly                  enable row level security;
alter table ads_accounts                 enable row level security;
alter table ads_daily_metrics            enable row level security;

-- =====================================================================
-- anon (顧客側 / 一般公開) に与える最小限のアクセス
-- =====================================================================

-- カウンセリングのアクティブフォームだけは anon が読める (フォーム表示のため)
drop policy if exists "anon_read_active_form" on counseling_form_definitions;
create policy "anon_read_active_form" on counseling_form_definitions
  for select to anon
  using (active = true);

-- 顧客は自分の回答を新規作成できる
drop policy if exists "anon_insert_counseling_response" on counseling_responses;
create policy "anon_insert_counseling_response" on counseling_responses
  for insert to anon
  with check (
    source in ('web','liff','qr')
    and consent_given_at is not null
  );

-- ドラフトは session_id ベースで保存・読取 (anon が自分の session_id 分のみ)
-- 注意: 本格運用では session_id を Cookie/JWT と紐付けないと他人のドラフトを読める
drop policy if exists "anon_upsert_own_draft" on counseling_drafts;
create policy "anon_upsert_own_draft" on counseling_drafts
  for all to anon
  using (true)
  with check (true);
-- ^ Phase D で Supabase Auth に切り替えたら session_id → auth.uid() に置換

-- 店舗は anon に公開 (カウンセリングフォームの店舗選択肢表示のため active のみ)
drop policy if exists "anon_read_active_stores" on stores;
create policy "anon_read_active_stores" on stores
  for select to anon
  using (active = true);

-- =====================================================================
-- service_role (Vercel API Routes サーバサイド用) はRLS をバイパスするので
-- 明示的なポリシー不要。全操作が可能。
-- =====================================================================

-- =====================================================================
-- authenticated (Phase D 以降 Supabase Auth を使う場合のスケルトン)
-- =====================================================================
-- 例: JWT custom claims に store_ids (text[]) と role (text) が入っている前提

-- ヘルパー関数: JWT から store_ids を取得
create or replace function auth_store_ids() returns text[] as $$
  select coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'store_ids')::text[],
    '{}'::text[]
  );
$$ language sql stable;

create or replace function auth_role() returns text as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
$$ language sql stable;

create or replace function auth_can_access_store(sid text) returns boolean as $$
  select auth_role() = 'headquarter' or sid = any(auth_store_ids());
$$ language sql stable;

-- customers: 自分の担当店舗分のみ
drop policy if exists "auth_store_customers" on customers;
create policy "auth_store_customers" on customers
  for all to authenticated
  using (store_id is null or auth_can_access_store(store_id))
  with check (store_id is null or auth_can_access_store(store_id));

-- cashbook_entries: 店舗縛り
drop policy if exists "auth_store_cashbook" on cashbook_entries;
create policy "auth_store_cashbook" on cashbook_entries
  for all to authenticated
  using (store_id is null or auth_can_access_store(store_id))
  with check (store_id is null or auth_can_access_store(store_id));

-- counseling_responses: 店舗縛り (スタッフ閲覧/編集用)
drop policy if exists "auth_store_counseling_responses" on counseling_responses;
create policy "auth_store_counseling_responses" on counseling_responses
  for select to authenticated
  using (store_id is null or auth_can_access_store(store_id));

drop policy if exists "auth_update_counseling_responses" on counseling_responses;
create policy "auth_update_counseling_responses" on counseling_responses
  for update to authenticated
  using (store_id is null or auth_can_access_store(store_id))
  with check (store_id is null or auth_can_access_store(store_id));

-- 以降、同じパターンで他テーブルも店舗縛りポリシーを追加する
-- (Phase D の PR で一括整備)

-- =====================================================================
-- Storage RLS
-- =====================================================================
-- 詳細: https://supabase.com/docs/guides/storage/security/access-control

-- vivie-public: 誰でも読める、書込みは service_role のみ
drop policy if exists "public_read_public_bucket" on storage.objects;
create policy "public_read_public_bucket" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'vivie-public');

-- vivie-counseling-uploads: anon が INSERT 可 (フォームからのアップロード)
drop policy if exists "anon_insert_counseling_upload" on storage.objects;
create policy "anon_insert_counseling_upload" on storage.objects
  for insert to anon
  with check (bucket_id = 'vivie-counseling-uploads');

-- vivie-customer: Phase D まではクライアント直アクセスを禁止 (Vercel 経由で署名付きURL発行)
-- authenticated で store スコープ縛りの読取は Phase D の PR で定義する

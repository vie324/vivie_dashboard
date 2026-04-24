# Supabase セットアップ

このディレクトリには vivie ダッシュボードが利用する Supabase のスキーマ定義とシードデータが格納されています。

## ディレクトリ構成

```
supabase/
├── migrations/       スキーマ定義 (SQL)。番号順に適用する
│   ├── 001_schema_core.sql            store, staff, dashboard_config
│   ├── 002_schema_customers.sql       customers, manual_memberships, member_usage
│   ├── 003_schema_counseling.sql      counseling_form_definitions, responses, drafts
│   ├── 004_schema_cashbook.sql        cashbook entries, daily_closes, audit_logs
│   ├── 005_schema_tickets.sql         ticket_plans, customer_tickets, usage_events
│   ├── 006_schema_daily_reports.sql   daily_reports
│   ├── 007_schema_line.sql            line_threads, messages, templates, auto_replies
│   ├── 008_schema_treatment.sql       treatment_reports, skin_analyses
│   ├── 009_schema_marketing.sql       hpb_monthly, ads_accounts, ads_daily_metrics
│   ├── 010_storage_buckets.sql        Storage バケット (vivie-public など)
│   └── 011_rls_policies.sql           Row Level Security ポリシー
└── seed/
    └── 001_counseling_form_v1.sql     カウンセリングフォーム v1 初期データ
```

## 初回セットアップ手順

### 1. プロジェクトの作成

1. https://supabase.com/dashboard にログイン
2. "New project" をクリック
3. プロジェクト名 (例: `vivie-production`)、データベースパスワードを設定
4. リージョンは `Northeast Asia (Tokyo)` を選択
5. 作成完了まで 2〜3 分待つ

### 2. API キーの取得

プロジェクトのダッシュボードで `Settings → API` を開き、以下をメモ:

- **Project URL** (例: `https://xxxxx.supabase.co`)
- **anon public key** — ブラウザに埋め込む用
- **service_role key** — Vercel 環境変数に入れる用 (絶対に GitHub に push しない)

### 3. スキーマの適用

Supabase Dashboard の `SQL Editor` で、以下の順に実行:

```
migrations/001_schema_core.sql
migrations/002_schema_customers.sql
migrations/003_schema_counseling.sql
migrations/004_schema_cashbook.sql
migrations/005_schema_tickets.sql
migrations/006_schema_daily_reports.sql
migrations/007_schema_line.sql
migrations/008_schema_treatment.sql
migrations/009_schema_marketing.sql
migrations/010_storage_buckets.sql
migrations/011_rls_policies.sql
seed/001_counseling_form_v1.sql
```

各ファイルの中身をコピー & ペーストして `Run` ボタンを押すだけです。
**順番が重要** なので番号通りに実行してください。

### 4. ダッシュボード側の接続設定

1. ダッシュボードの `設定` タブを開く
2. 「Supabase 接続設定」セクションを開く
3. Project URL と anon public key を入力して保存
4. 「接続テスト」ボタンで疎通確認

### 5. LINE LIFF アプリの設定

1. https://developers.line.biz/console/ にログイン
2. 既存の LINE 公式アカウントのチャネル (Messaging API) を開く
3. LIFF タブで "Add" を押して新規作成
   - **LIFF app name**: `vivie カウンセリング`
   - **Size**: `Full`
   - **Endpoint URL**: `https://<ダッシュボードのドメイン>/?view=counseling-form`
   - **Scope**: `profile`, `openid`
   - **Bot link feature**: `On (aggressive)`
4. 発行された LIFF ID をメモ (例: `1234567890-AbCdEfGh`)
5. ダッシュボードの `設定 → Supabase 接続設定` で LIFF ID を入力して保存

### 6. 既存データのバックフィル

`scripts/backfill/` 配下のスクリプトで、既存の GAS+Sheets からデータを移行します。
各 PR で対応するスクリプトを追加していくので、そのタイミングで実行してください。

## トラブルシューティング

### RLS のせいでデータが見えない

`migrations/011_rls_policies.sql` を適用しましたか?
anon key でクライアントから読み書きしているのに、クライアントが認証されていない場合、
スタッフ向けテーブルは見えません。Phase D までは Vercel API Routes 経由で service_role key を
使ってアクセスするか、`011_rls_policies.sql` 末尾のコメントを参考に、
一時的に読取ポリシーを緩めてください (推奨しません)。

### Migration の適用順を間違えた

すべて一度 `drop table ... cascade;` してから最初からやり直すのが一番簡単です。
テスト環境では全テーブルを削除する以下のクエリを使えます (本番では実行しないこと):

```sql
-- 危険: 全テーブル削除 (テスト環境限定)
do $$
declare
  r record;
begin
  for r in (select tablename from pg_tables where schemaname = 'public') loop
    execute 'drop table if exists public.' || quote_ident(r.tablename) || ' cascade;';
  end loop;
end $$;
```

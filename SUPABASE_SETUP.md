# Supabase 移行 — 全体セットアップガイド

vivie ダッシュボードの永続化層を GAS + Google Sheets から Supabase (Postgres) に移行するためのガイドです。

## 移行の進め方

| PR | 内容 | 所要目安 | 依存 |
|---|---|---|---|
| #1 | **Supabase 基盤 + 接続設定 UI + スキーマ適用** (← イマココ) | 2-3日 | - |
| #2 | 店舗・スタッフマスタ | 3-4日 | #1 |
| #3 | カウンセリング内製化 + LIFF + 既存データ移行 | 7-10日 | #2 |
| #4 | 会員管理・利用回数 | 5-6日 | #3 |
| #5 | 出納帳 | 4-5日 | #4 |
| #6 | 回数券 | 3日 | #4 |
| #7 | 日報・LINE | 5-6日 | #4 |
| #8 | マーケティング (HPB/Meta/TikTok) | 3-4日 | #1 |
| #9 | 施術レポート・肌分析 (+画像) | 4-5日 | #4 |
| #10 | GAS 呼び出し削除・クリーンアップ | 2-3日 | 全PR |

## PR #1 で整備したもの

- ✅ `supabase/migrations/001..011_*.sql` — 全テーブル定義
- ✅ `supabase/seed/001_counseling_form_v1.sql` — カウンセリング初期質問
- ✅ `supabase/README.md` — 初回セットアップ手順
- ✅ ダッシュボード側に `Supabase 接続設定` UI (設定タブ)
- ✅ ダッシュボード側に `supabaseClient` ヘルパーと接続診断
- ✅ LINE LIFF SDK の読込み (カウンセリングフォームで利用)

## 必要な外部設定 (ユーザー作業)

### 1. Supabase プロジェクト作成

`supabase/README.md` の手順に従ってプロジェクトを作成し、
`migrations/` と `seed/` の SQL を順番に実行してください。

### 2. Project URL と anon key を控える

`Settings → API` から取得。これをダッシュボードの設定画面に入力します。
**anon key は index.html に埋め込まれる公開キーなので GitHub に push しても OK**。
一方、**service_role key は絶対にフロントに出さない** こと。

### 3. LINE LIFF アプリ作成

https://developers.line.biz/console/ で既存の Messaging API チャネルに
LIFF アプリを追加。Endpoint URL は `https://<ダッシュボードドメイン>/?view=counseling-form`
(PR #3 で有効化)。

### 4. Vercel 環境変数 (PR #3 以降)

Vercel のプロジェクト設定に以下を追加:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
LIFF_ID=...   (フロントで使うので、ダッシュボード設定画面から入力でも可)
```

service_role key は Vercel API Routes 経由で重い処理
(バックフィル / 管理者専用クエリ / ストレージ署名付き URL 発行) を行う際に使います。

### 5. 既存データのバックフィル

各 PR (#2, #3, #4 …) でバックフィルスクリプトを `scripts/backfill/` に追加します。
PR をマージしたあとに、GAS スプレッドシートのデータを CSV エクスポート → スクリプトを
Node.js で実行 → Supabase に流し込む、という流れです。

## 進行状況の把握

PR がマージされるたびに本ファイルの `✅` を更新します。
次は **PR #2 (店舗・スタッフマスタ移行)** の予定です。

## セキュリティ Phase 1 との関係

先日入れた PBKDF2 + HMAC + AES-GCM は **Phase A〜C の間は維持**。
Phase D (認証統合) で Supabase Auth に置き換える際に、一部を撤去します:

- パスワードハッシュ化 → Supabase Auth の bcrypt が代替
- HMAC トークン → Supabase JWT (RS256) が代替
- AES-GCM の PII 暗号化 → 残す (オフラインキャッシュ保護用途)

## ロールバック戦略

各 PR は独立してロールバック可能:

- クライアント側の変更 → Git で revert
- スキーマ変更 → `drop table if exists` 系のスクリプトを PR に同梱
- 既存の GAS 呼び出しは PR #10 までは生きているので、Supabase 側を無効化すれば
  即座に旧動作に戻る

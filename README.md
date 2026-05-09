# Vivie Dashboard

エステサロン Vivie の統合管理ダッシュボード。
**Next.js 14 (App Router) + Supabase + Square API + Vercel** で構築。

## 主な機能

| 機能 | 内容 |
| --- | --- |
| 会員管理 | Square 連携 + 手動登録の統合管理 |
| サブスク | Square Subscription を自動同期、MRR 表示 |
| カウンセリング | 公開 URL からお客様が直接入力 (Google Form 置き換え) |
| 出納帳 | 月次の収支管理。Square 決済は Webhook で自動記帳 |
| 日報 | スタッフ専用 URL からの入力。リピート率を自動算出 |
| 勤怠 | 店舗から半径 300m 以内のみ打刻可能な GPS 認証 |
| 設定 | 店舗座標、スタッフロール、専用 URL の管理 |

## 技術スタック

- **Next.js 14** (App Router, Server Components, Server Actions)
- **TypeScript**
- **Tailwind CSS** + 独自カラーパレット (vivie / ink)
- **Supabase** (Postgres + Auth + RLS)
- **Square SDK** (顧客 / サブスク / 決済 / Webhook)
- **Vercel** (デプロイ先, Tokyo region: `hnd1`)

## ディレクトリ構成

```
app/
├── (dashboard)/        # 認証必須エリア (サイドバー付きレイアウト)
│   ├── page.tsx        # ダッシュボード
│   ├── members/        # 会員管理
│   ├── subscriptions/  # サブスク
│   ├── counseling/     # カウンセリング
│   ├── cashbook/       # 出納帳
│   ├── reports/        # 日報
│   ├── attendance/     # 勤怠 (GPS)
│   └── settings/       # 設定 (admin/manager)
├── counseling/public/[storeId]/  # 公開カウンセリングフォーム
├── staff/report/[token]/         # スタッフ専用 日報入力 URL
├── login/                        # ログイン
├── auth/signout/                 # ログアウト
└── api/
    ├── square/sync               # Square 全同期
    ├── square/webhook            # Square Webhook 受信
    ├── attendance                # GPS 打刻
    └── staff/report/[token]      # 公開 URL 経由の日報送信

components/
├── ui/                # ボタン、入力、カード、トースト等
├── dashboard/         # サイドバー、トップバー、KPI カード
├── members/           # 会員一覧、会員フォーム
├── counseling/        # カウンセリングフォーム、レビュー操作
├── cashbook/          # 出納帳ビュー
├── reports/           # 日報フォーム
├── attendance/        # GPS 打刻パネル
└── settings/          # 店舗・スタッフ設定

lib/
├── supabase/          # client / server / middleware
├── square/            # Square SDK ラッパー
├── auth.ts            # 現在ユーザー取得
├── geo.ts             # Haversine 距離計算
└── utils.ts           # フォーマッタ等

supabase/
├── migrations/
│   ├── 20260509000001_init.sql       # 全テーブル + RLS
│   └── 20260509000002_auth_sync.sql  # auth.users → staff 自動同期
├── seed.sql           # 初期店舗 / プラン
└── config.toml        # Supabase CLI 設定

types/database.ts      # Supabase 型定義
middleware.ts          # 認証ミドルウェア
legacy/                # 旧 GAS 版 (参考用に保管)
```

## セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. Supabase プロジェクト

1. <https://supabase.com> で新規プロジェクト作成
2. Settings > API から以下を取得:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. SQL Editor で `supabase/migrations/` のファイルを順番に実行
4. (任意) `supabase/seed.sql` で初期店舗・プランを投入

または Supabase CLI を使用:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 3. Square 連携

1. <https://developer.squareup.com/apps> でアプリ作成
2. Production の Access Token を取得 → `SQUARE_ACCESS_TOKEN`
3. Locations API で取得した location_id を `SQUARE_LOCATION_IDS` (カンマ区切り) に設定
4. Webhook を `https://<your-domain>/api/square/webhook` で登録
   - イベント: `customer.*`, `subscription.*`, `payment.*`
   - Signature key を `SQUARE_WEBHOOK_SIGNATURE_KEY` に設定

### 4. 環境変数

`.env.example` を `.env.local` にコピーして値を埋める。

```bash
cp .env.example .env.local
```

### 5. ローカル起動

```bash
npm run dev
```

ブラウザで <http://localhost:3000> を開く。

### 6. Vercel デプロイ

```bash
vercel
```

または GitHub 連携で自動デプロイ。
環境変数は Vercel ダッシュボードから設定。

## スタッフの追加方法

1. Supabase ダッシュボード > Authentication > Users で
   メール+パスワードでユーザーを作成
2. トリガー (`handle_new_auth_user`) により `staff` テーブルに
   自動でレコードが作成される (role = `staff`、token も自動発行)
3. 設定画面 (`/settings`) から、表示名・役割・所属店舗を設定
4. 日報用専用 URL は同画面でコピー & スタッフに共有

## 店舗座標の登録

設定画面 (`/settings`) > 店舗 から:

- 住所を入力
- 「**現在地で設定**」ボタン: スタッフの端末で店舗内から押すと
  GPS で店舗の緯度経度が自動入力される
- 許容範囲はデフォルト 300m。50〜2000m で調整可

## 公開 URL

| 用途 | URL |
| --- | --- |
| お客様用カウンセリング | `/counseling/public/<storeId>` |
| スタッフ専用 日報入力 | `/staff/report/<token>` |

これらは未認証でもアクセス可能 (token / storeId が有効な場合のみ書き込み可能)。

## ロール

| ロール | 権限 |
| --- | --- |
| `admin` | すべて (店舗・スタッフの追加削除を含む) |
| `manager` | 全会員・全日報の閲覧、店舗マスタ参照 |
| `staff` | 自分の日報・勤怠、共通の会員/カウンセリング/出納帳 |

## 移行メモ (旧 GAS 版から)

- 旧 `index.html` は `legacy/` に保管
- GAS の Spreadsheet データ → 必要に応じて以下の SQL で取り込み:
  - members: `INSERT INTO members (...) VALUES (...);`
  - cashbook: `INSERT INTO cashbook_entries (...) VALUES (...);`
- Square 顧客は `/api/square/sync` を 1 度実行すれば一括取り込み

## 開発コマンド

```bash
npm run dev        # 開発サーバー
npm run build      # 本番ビルド
npm run start      # 本番起動
npm run lint       # ESLint
npm run typecheck  # TypeScript チェック
```

## ライセンス

私的利用 (Vivie 専用)。

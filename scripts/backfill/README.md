# バックフィルスクリプト

既存の Google Sheets (GAS) データを Supabase に移行するための Node.js スクリプト群です。

## 共通セットアップ

```bash
cd scripts/backfill
npm init -y
npm install @supabase/supabase-js csv-parse dotenv
```

`.env` ファイルを作成 (`.gitignore` 対象):

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
GAS_EXPORT_DIR=./exports
```

## スクリプト一覧 (PR ごとに追加)

| PR | スクリプト | 内容 |
|---|---|---|
| #2 | `backfill-stores.mjs` | 店舗マスタ |
| #2 | `backfill-staff.mjs` | スタッフ (PBKDF2 ハッシュ込み) |
| #3 | `backfill-counseling.mjs` | 過去の Google Form 回答 |
| #4 | `backfill-customers.mjs` | 手動会員 + Square 会員マッピング |
| #4 | `backfill-member-usage.mjs` | 利用回数履歴 |
| #5 | `backfill-cashbook.mjs` | 出納帳エントリ + 日次締め + 監査ログ |
| #6 | `backfill-tickets.mjs` | 回数券プラン + 顧客回数券 |
| #7 | `backfill-daily-reports.mjs` | 日報 |
| #7 | `backfill-line.mjs` | LINE スレッド + メッセージ + テンプレート |
| #8 | `backfill-hpb.mjs` | HPB 月次データ |
| #9 | `backfill-treatment-reports.mjs` | 施術レポート (+ 画像 Storage アップロード) |
| #9 | `backfill-skin-analyses.mjs` | 肌分析履歴 (+ 画像) |

各スクリプトは冪等 (何度実行してもOK) に作ります。
`ON CONFLICT DO UPDATE` または `upsert` を利用。

## 実行手順 (共通)

1. Google Sheets から対象シートを CSV でダウンロード (ファイル > ダウンロード > CSV)
2. `exports/` ディレクトリに配置
3. `node backfill-xxx.mjs` で実行
4. 実行ログ (成功/失敗件数、エラー行) を確認
5. Supabase Dashboard でデータが入ったか確認
6. 問題なければ dual-write を切り戻し (PR #10 で実施)

## エラーが出たとき

- Dry-run モード: `node backfill-xxx.mjs --dry-run` (実際には書き込まず、差分だけログ出力)
- 特定行だけ: `node backfill-xxx.mjs --only-row 12`
- 範囲指定: `node backfill-xxx.mjs --from 10 --to 20`

これらのオプションは各スクリプトで実装する想定。

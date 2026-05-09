# public/ フォルダ

このフォルダの中身はそのまま `https://<your-domain>/<filename>` で公開されます。

## ロゴ画像の配置方法

1. お送りいただいた **vivie ロゴ画像** をローカルの PC に保存します
   (例: `~/Downloads/vivie-logo.png`)
2. ファイル名を **`vivie-logo.png`** にリネーム
3. このフォルダ (`public/`) に配置:
   - GitHub の Web UI で `public/` フォルダを開き、「Add file > Upload files」
   - または `git mv ~/Downloads/vivie-logo.png public/vivie-logo.png && git add public/vivie-logo.png`
4. コミット & プッシュ → Vercel が自動デプロイ

ロゴが配置されると、以下の場所で自動表示されます:

- **スプラッシュスクリーン** (アプリ起動時 1〜2 秒)
- **サイドバー** 左上
- **ログインページ** 中央
- **スタッフ専用ページ** ヘッダー
- **公開カウンセリングフォーム** ヘッダー
- **ブラウザ favicon**
- **iOS / Android ホーム画面追加時のアイコン**

## 推奨ファイル仕様

- **形式**: PNG (透過なし or 単色背景) / JPG
- **解像度**: 512x512px 以上 (正方形)
- **ファイルサイズ**: 200KB 以下推奨

ファイルが見つからない場合は自動的に「v」のテキストフォールバックが表示されます。

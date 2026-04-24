-- ================================================================
-- 010: Storage バケット
-- ================================================================
-- 注意: Storage バケットは Supabase Dashboard の UI または SQL で作成できます。
-- ここでは SQL を使います (supabase.storage.buckets テーブルは storage スキーマ上)

-- vivie-public: anon が読める公開バケット (ロゴ、ブランド素材など)
insert into storage.buckets (id, name, public)
  values ('vivie-public', 'vivie-public', true)
  on conflict (id) do nothing;

-- vivie-customer: 顧客関連の PII 画像 (認証必須)
insert into storage.buckets (id, name, public)
  values ('vivie-customer', 'vivie-customer', false)
  on conflict (id) do nothing;

-- vivie-counseling-uploads: カウンセリングフォームからの顧客アップロード
-- anon の INSERT のみ許可、あとはスタッフ読取
insert into storage.buckets (id, name, public)
  values ('vivie-counseling-uploads', 'vivie-counseling-uploads', false)
  on conflict (id) do nothing;

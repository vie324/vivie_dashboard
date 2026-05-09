-- 初期シード: デフォルト店舗とスタッフロール例
-- 本番投入前に必ず編集してください

insert into public.stores (id, name, address, latitude, longitude, radius_meters)
values (
  '11111111-1111-1111-1111-111111111111',
  'Vivie 本店',
  '住所未設定',
  null,
  null,
  300
) on conflict (id) do nothing;

-- サンプルプラン
insert into public.subscription_plans (name, monthly_price, monthly_visit_limit, carryover_months)
values
  ('ライトプラン', 9800, 1, 1),
  ('スタンダードプラン', 16800, 2, 1),
  ('プレミアムプラン', 28000, 4, 2)
on conflict do nothing;

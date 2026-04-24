-- ================================================================
-- Seed: カウンセリングフォーム v1 (既存 Google Form 項目を移植)
-- ================================================================
-- index.html の CONCERN_ITEMS / FEEDBACK_ITEMS に合わせた質問セット。
-- 実際の Google Form の質問文と齟齬があれば PR #3 で調整してください。

insert into counseling_form_definitions (version, title, schema, active, activated_at)
values (
  1,
  'vivie カウンセリングシート v1',
  $$
  [
    {
      "id": "consent",
      "type": "consent",
      "label": "個人情報の取り扱いに同意します",
      "description": "ご入力いただいた情報は、当サロンでのカウンセリングおよびサービス提供のためにのみ使用し、法令に基づく場合を除き第三者へ提供することはありません。",
      "required": true
    },
    {
      "id": "name",
      "type": "text",
      "label": "お名前",
      "placeholder": "山田 花子",
      "required": true
    },
    {
      "id": "name_kana",
      "type": "text",
      "label": "フリガナ",
      "placeholder": "ヤマダ ハナコ"
    },
    {
      "id": "phone",
      "type": "tel",
      "label": "電話番号",
      "placeholder": "090-1234-5678",
      "required": true
    },
    {
      "id": "email",
      "type": "email",
      "label": "メールアドレス",
      "placeholder": "example@example.com"
    },
    {
      "id": "age_range",
      "type": "radio",
      "label": "年齢層",
      "required": true,
      "options": ["20代前半", "20代後半", "30代前半", "30代後半", "40代", "50代以上"]
    },
    {
      "id": "gender",
      "type": "radio",
      "label": "性別",
      "options": ["女性", "男性", "回答しない"]
    },
    {
      "id": "concerns",
      "type": "checkbox",
      "label": "気になるお悩み箇所 (複数選択可)",
      "description": "当てはまるものをすべてお選びください",
      "required": true,
      "options": [
        { "value": "c1",  "label": "頭・はちの張り",          "category": "face" },
        { "value": "c2",  "label": "眼精疲労",                "category": "face" },
        { "value": "c3",  "label": "頬のたるみ",              "category": "face" },
        { "value": "c4",  "label": "食いしばり・エラの張り",   "category": "face" },
        { "value": "c5",  "label": "顔の左右差",              "category": "face" },
        { "value": "c6",  "label": "首・ストレートネック",     "category": "posture" },
        { "value": "c7",  "label": "肩こり",                  "category": "posture" },
        { "value": "c8",  "label": "姿勢・猫背",              "category": "posture" },
        { "value": "c9",  "label": "反り腰",                  "category": "posture" },
        { "value": "c10", "label": "腰痛",                    "category": "pelvis" },
        { "value": "c11", "label": "股関節・膝の痛み",         "category": "pelvis" },
        { "value": "c12", "label": "冷え・むくみ",            "category": "pelvis" },
        { "value": "c13", "label": "生理痛・生理不順",         "category": "pelvis" },
        { "value": "c14", "label": "下半身太り",              "category": "pelvis" },
        { "value": "c15", "label": "骨盤の歪み",              "category": "pelvis" },
        { "value": "c16", "label": "X脚・O脚",               "category": "pelvis" }
      ]
    },
    {
      "id": "face_zones",
      "type": "face_zone_map",
      "label": "特に気になる顔の部位をタップしてください",
      "description": "顔のイラスト上で、気になる部位をタップしてください (任意)"
    },
    {
      "id": "attachments",
      "type": "image_upload",
      "label": "気になる部位の写真 (任意・最大3枚)",
      "description": "正面からのお顔や気になる部位の写真をアップロードしていただけると、より精度の高いアドバイスが可能です",
      "max_files": 3,
      "bucket": "vivie-counseling-uploads"
    },
    {
      "id": "desired_treatments",
      "type": "checkbox",
      "label": "ご希望の施術 (複数選択可)",
      "options": [
        "小顔矯正",
        "骨格矯正 (肩こり・姿勢)",
        "骨盤矯正",
        "フェイシャル (肌ケア)",
        "ボディケア",
        "頭皮ケア (スカルプ)",
        "まだ決まっていない・相談したい"
      ]
    },
    {
      "id": "past_treatments",
      "type": "checkbox",
      "label": "過去に受けたことのある施術 (複数選択可)",
      "options": [
        "整体・カイロプラクティック",
        "小顔矯正・骨格矯正",
        "エステ (フェイシャル)",
        "エステ (痩身)",
        "マッサージ・もみほぐし",
        "美容医療 (注射・レーザー等)",
        "特になし"
      ]
    },
    {
      "id": "skin_self_assessment",
      "type": "scale_group",
      "label": "肌の自己評価 (5段階)",
      "description": "1: とても気になる … 5: 全く気にならない",
      "items": [
        { "key": "moisture",  "label": "乾燥・うるおい" },
        { "key": "firmness",  "label": "ハリ・弾力" },
        { "key": "tone",      "label": "くすみ・トーン" },
        { "key": "pores",     "label": "毛穴" },
        { "key": "roughness", "label": "肌荒れ・ごわつき" }
      ],
      "scale": 5
    },
    {
      "id": "visit_frequency",
      "type": "radio",
      "label": "ご希望の通院頻度",
      "options": [
        "月4回以上 (集中ケア)",
        "月2〜3回",
        "月1回",
        "相談して決めたい"
      ]
    },
    {
      "id": "budget",
      "type": "radio",
      "label": "月々のご予算",
      "options": [
        "1万円まで",
        "1〜2万円",
        "2〜3万円",
        "3万円以上",
        "相談したい"
      ]
    },
    {
      "id": "free_text",
      "type": "textarea",
      "label": "ご要望・気になることをご自由にお書きください",
      "placeholder": "施術に関するご希望、不安な点、質問などご自由にどうぞ"
    },
    {
      "id": "referral",
      "type": "radio",
      "label": "当サロンをどこで知りましたか?",
      "options": [
        "ホットペッパービューティ",
        "Instagram",
        "TikTok",
        "Google検索",
        "お友達の紹介",
        "通りがかり",
        "その他"
      ]
    }
  ]
  $$::jsonb,
  true,
  now()
)
on conflict (version) do update set
  schema = excluded.schema,
  active = true,
  activated_at = now();

-- 他のバージョンを非アクティブ化
update counseling_form_definitions set active = false where version != 1;

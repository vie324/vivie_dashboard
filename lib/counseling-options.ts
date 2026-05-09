// カウンセリングフォームの選択肢定義 (Google Form 内容を踏襲)
export const VISIT_REASONS = [
  { value: 'price', label: '価格が条件と合っていた' },
  { value: 'location', label: '立地が良かった' },
  { value: 'sns', label: 'SNS の発信が魅力的だった' },
  { value: 'hpb', label: 'ホットペッパービューティーの内容が魅力的だった' },
  { value: 'menu', label: '希望のメニューがあった' },
  { value: 'reviews', label: '口コミが良かった' },
  { value: 'other', label: 'その他' },
];

export const PAST_TREATMENTS = [
  { value: 'small_face', label: '小顔矯正' },
  { value: 'dry_head_spa', label: 'ドライヘッドスパ' },
  { value: 'hydra', label: 'ハイドラ' },
  { value: 'plasma', label: 'プラズマ' },
  { value: 'ems', label: 'EMS' },
  { value: 'rf', label: 'ラジオ波' },
  { value: 'herb_peel', label: 'ハーブピーリング' },
  { value: 'lemon_bottle', label: 'レモンボトル' },
  { value: 'face_wax', label: 'フェイシャルワックス' },
  { value: 'none', label: 'なし' },
];

export const SWITCH_REASONS = [
  { value: 'try_here', label: '当店を試してみたかった' },
  { value: 'often_change', label: 'よくサロンを変える' },
  { value: 'availability', label: '前のサロンが予約取りづらかった' },
  { value: 'dissatisfaction', label: '前のサロンに不満があった' },
  { value: 'other', label: 'その他' },
];

export const PAST_COMPLAINTS = [
  { value: 'hygiene', label: '衛生面が気になった' },
  { value: 'noise', label: '騒がしかった' },
  { value: 'duration', label: '施術時間が長かった' },
  { value: 'conversation', label: '会話が不快だった' },
  { value: 'unfriendly', label: '愛想が悪かった' },
  { value: 'attitude', label: '態度が悪かった' },
  { value: 'sales', label: '営業がしつこかった' },
  { value: 'no_effect', label: '効果がなかった' },
  { value: 'no_lasting', label: '効果が持続しなかった' },
  { value: 'other', label: 'その他' },
];

export const SKIN_CONCERNS = [
  { value: 'pores', label: '毛穴' },
  { value: 'acne', label: 'ニキビ' },
  { value: 'spots', label: 'シミ' },
  { value: 'irritation', label: '肌荒れ' },
  { value: 'dryness', label: '乾燥' },
  { value: 'other', label: 'その他' },
];

export const FACE_CONCERNS = [
  { value: 'sagging', label: 'たるみ' },
  { value: 'nasolabial', label: 'ほうれい線' },
  { value: 'double_chin', label: '二重あご' },
  { value: 'jaw_tension', label: 'エラ張り' },
  { value: 'asymmetry', label: '左右非対称' },
  { value: 'misalignment', label: '骨格のゆがみ' },
  { value: 'puffiness', label: 'むくみ' },
  { value: 'other', label: 'その他' },
];

export const BODY_CONCERNS = [
  { value: 'head', label: '頭・こめかみのこり' },
  { value: 'eye', label: '眼精疲労' },
  { value: 'neck', label: '首・ストレートネック' },
  { value: 'shoulder', label: '肩こり' },
  { value: 'other', label: 'その他' },
];

export const GOAL_TIMELINES = [
  { value: 'event', label: 'イベント前まで' },
  { value: '3m', label: '3ヶ月以内' },
  { value: '6m', label: '半年以内' },
  { value: '1y', label: '1年以内' },
];

export const MONTHLY_BUDGETS = [
  { value: 'minimal', label: 'お金はかけたくない' },
  { value: '10k', label: '~ 1万円' },
  { value: '20-30k', label: '2〜3万円' },
  { value: '30-50k', label: '3〜5万円' },
  { value: '50k+', label: '5万円以上' },
];

export function labelOf(options: { value: string; label: string }[], value: string | null) {
  if (!value) return '—';
  return options.find((o) => o.value === value)?.label ?? value;
}

export function labelsOf(options: { value: string; label: string }[], values: string[] | null) {
  if (!values || values.length === 0) return [];
  return values.map((v) => options.find((o) => o.value === v)?.label ?? v);
}

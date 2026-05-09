// 施術レポートの肌・顔・体スコアの軸定義 (1-5 スケール)
// レーダーチャートで可視化する

export interface ScoreAxis {
  key: string;
  label: string;
  description?: string;
}

export const SKIN_AXES: ScoreAxis[] = [
  { key: 'clarity', label: '透明感', description: '肌のくすみのなさ' },
  { key: 'moisture', label: 'うるおい', description: '水分量・しっとり感' },
  { key: 'elasticity', label: 'ハリ', description: '弾力' },
  { key: 'texture', label: 'キメ', description: '肌の整い' },
  { key: 'pores', label: '毛穴', description: '毛穴の目立たなさ' },
  { key: 'spots', label: 'シミ', description: 'シミの少なさ' },
];

export const FACE_AXES: ScoreAxis[] = [
  { key: 'symmetry', label: '左右対称' },
  { key: 'lift', label: 'リフト感' },
  { key: 'fold', label: 'ほうれい線', description: '目立たなさ' },
  { key: 'jawline', label: 'フェイスライン' },
  { key: 'puffiness', label: 'むくみ', description: 'むくみの少なさ' },
  { key: 'eye_area', label: '目元', description: 'クマ・たるみのなさ' },
];

export const BODY_AXES: ScoreAxis[] = [
  { key: 'shoulder', label: '肩こり', description: '緩和度' },
  { key: 'neck', label: '首', description: '可動域' },
  { key: 'head', label: '頭部', description: 'リラックス' },
  { key: 'eye_strain', label: '眼精疲労' },
];

export type ScoreMap = Record<string, number>;

export function emptyScores(axes: ScoreAxis[]): ScoreMap {
  return Object.fromEntries(axes.map((a) => [a.key, 3]));
}

export function avgScore(axes: ScoreAxis[], scores: ScoreMap): number {
  const values = axes.map((a) => Number(scores[a.key]) || 0).filter((v) => v > 0);
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

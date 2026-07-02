// チャート共通テーマ。
// カテゴリカルパレットは OKLCH の明度帯・彩度床・CVD 分離・コントラストを
// ライト/ダーク両サーフェスで検証済み (dataviz validator)。系列には必ず
// この固定順で割り当て、フィルタで系列数が変わっても色を詰め直さない。
export const CHART_SERIES = {
  rose: '#C25E5B', // 主系列 (決済ベース売上 など)
  gold: '#9C7A1E', // 第2系列 (日報売上 など)
  teal: '#0E9488', // 第3系列 (新規/継続 など)
  indigo: '#6673D6', // 第4系列
} as const;

export const CHART_ORDER: string[] = [
  CHART_SERIES.rose,
  CHART_SERIES.gold,
  CHART_SERIES.teal,
  CHART_SERIES.indigo,
];

// ステータス色 (系列色としては使わない)
export const CHART_STATUS = {
  good: '#1B7F4B',
  warning: '#B45309',
  serious: '#B91C1C',
} as const;

export const CHART_GRID = '#EFEDE9';
export const CHART_TICK = { fontSize: 10, fill: '#6B6359' } as const;

export const CHART_TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid #E5E1DA',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(31,27,22,0.10)',
} as const;

export function yenTick(v: number): string {
  if (Math.abs(v) >= 1000000) return `¥${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `¥${Math.round(v / 1000)}k`;
  return `¥${v}`;
}

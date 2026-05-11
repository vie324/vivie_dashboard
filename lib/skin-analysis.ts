// 肌分析: 画像から 6 指標を算出する純粋関数モジュール
// レガシー SPA の Skin Analyzer (saRunFullAnalysis) を TS 移植したもの
// 入力 ImageData → 各指標 0-100 + グレード判定

export type SkinMetricKey =
  | 'uniformity'
  | 'redness'
  | 'texture'
  | 'pigment'
  | 'firmness'
  | 'moisture';

export type SkinGrade = 'excellent' | 'good' | 'caution' | 'warning';

export interface SkinMetric {
  score: number; // 0-100
  grade: SkinGrade;
}

export interface SkinAnalysisResult {
  metrics: Record<SkinMetricKey, SkinMetric>;
  totalScore: number; // 0-100
  timestamp: string;
}

export const SKIN_METRIC_DEFS: { key: SkinMetricKey; label: string; desc: string }[] = [
  { key: 'uniformity', label: '色ムラ・くすみ', desc: '肌色の均一性と透明感' },
  { key: 'redness', label: '赤み・炎症', desc: '炎症や赤みの程度' },
  { key: 'texture', label: '毛穴・キメ', desc: '肌表面のなめらかさ' },
  { key: 'pigment', label: 'シミ・色素沈着', desc: '色素沈着やシミの程度' },
  { key: 'firmness', label: 'ハリ・たるみ', desc: '輪郭の左右対称性' },
  { key: 'moisture', label: '水分・油分', desc: '推定うるおいバランス' },
];

export const SKIN_GRADE_DEFS: Record<SkinGrade, { label: string; min: number; tone: string }> = {
  excellent: { label: '優秀', min: 80, tone: 'green' },
  good: { label: '良好', min: 65, tone: 'lime' },
  caution: { label: '注意', min: 45, tone: 'amber' },
  warning: { label: '要改善', min: 0, tone: 'red' },
};

interface FaceZone {
  key: 'forehead' | 'leftCheek' | 'rightCheek' | 'nose' | 'chin' | 'underEyeL' | 'underEyeR';
  x: number;
  y: number;
  w: number;
  h: number;
}

const FACE_ZONES: FaceZone[] = [
  { key: 'forehead', x: 0.3, y: 0.08, w: 0.4, h: 0.15 },
  { key: 'leftCheek', x: 0.08, y: 0.38, w: 0.25, h: 0.22 },
  { key: 'rightCheek', x: 0.67, y: 0.38, w: 0.25, h: 0.22 },
  { key: 'nose', x: 0.38, y: 0.32, w: 0.24, h: 0.25 },
  { key: 'chin', x: 0.32, y: 0.72, w: 0.36, h: 0.16 },
  { key: 'underEyeL', x: 0.15, y: 0.3, w: 0.18, h: 0.1 },
  { key: 'underEyeR', x: 0.67, y: 0.3, w: 0.18, h: 0.1 },
];

interface Pixel {
  r: number;
  g: number;
  b: number;
}

interface Lab {
  L: number;
  a: number;
  b: number;
}

interface Baseline {
  meanL: number;
  meanA: number;
  meanB: number;
  sdL: number;
  sdA: number;
  sdB: number;
}

function rgbToLab(r: number, g: number, b: number): Lab {
  let rl = r / 255;
  let gl = g / 255;
  let bl = b / 255;
  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  let z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

function trimmedMean(arr: number[], trim = 0.05): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const t = Math.floor(sorted.length * trim);
  const trimmed = sorted.slice(t, sorted.length - t);
  if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)];
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function trimmedSD(arr: number[], trim = 0.05): number {
  if (arr.length < 3) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const t = Math.floor(sorted.length * trim);
  const trimmed = sorted.slice(t, sorted.length - t);
  if (trimmed.length < 2) return 0;
  const mean = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  return Math.sqrt(trimmed.reduce((s, v) => s + (v - mean) ** 2, 0) / trimmed.length);
}

// Gray World ホワイトバランス補正
function whiteBalance(imageData: ImageData): ImageData {
  const data = imageData.data;
  const len = data.length;
  const step = Math.max(1, Math.floor(len / (4 * 50000))) * 4;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  for (let i = 0; i < len; i += step) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
    count++;
  }
  if (count === 0) return imageData;
  const avgR = sumR / count;
  const avgG = sumG / count;
  const avgB = sumB / count;
  const avgGray = (avgR + avgG + avgB) / 3;
  const scaleR = Math.min(1.5, Math.max(0.7, avgGray / (avgR || 1)));
  const scaleG = Math.min(1.5, Math.max(0.7, avgGray / (avgG || 1)));
  const scaleB = Math.min(1.5, Math.max(0.7, avgGray / (avgB || 1)));
  const corrected = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
  const cd = corrected.data;
  for (let i = 0; i < len; i += 4) {
    cd[i] = Math.min(255, Math.round(data[i] * scaleR));
    cd[i + 1] = Math.min(255, Math.round(data[i + 1] * scaleG));
    cd[i + 2] = Math.min(255, Math.round(data[i + 2] * scaleB));
    cd[i + 3] = data[i + 3];
  }
  return corrected;
}

// 楕円マスク内でゾーン領域のピクセルを抽出
function getPixelsInZone(
  imageData: ImageData,
  zone: FaceZone,
  ovalCx: number,
  ovalCy: number,
  ovalRx: number,
  ovalRy: number,
): Pixel[] {
  const pixels: Pixel[] = [];
  const zoneX = Math.round(ovalCx - ovalRx + zone.x * 2 * ovalRx);
  const zoneY = Math.round(ovalCy - ovalRy + zone.y * 2 * ovalRy);
  const zoneW = Math.round(zone.w * 2 * ovalRx);
  const zoneH = Math.round(zone.h * 2 * ovalRy);
  const w = imageData.width;
  const data = imageData.data;
  const sampleStep = Math.max(1, Math.min(3, Math.floor(Math.max(zoneW, zoneH) / 60)));
  for (let y = zoneY; y < zoneY + zoneH && y < imageData.height; y += sampleStep) {
    for (let x = zoneX; x < zoneX + zoneW && x < w; x += sampleStep) {
      if (x < 0 || y < 0) continue;
      const dx = (x - ovalCx) / ovalRx;
      const dy = (y - ovalCy) / ovalRy;
      if (dx * dx + dy * dy <= 1) {
        const i = (y * w + x) * 4;
        if (i >= 0 && i < data.length - 2) {
          pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
        }
      }
    }
  }
  return pixels;
}

// 2D グレースケールグリッド (テクスチャ解析用)
function getPixelGrid(
  imageData: ImageData,
  zone: FaceZone,
  ovalCx: number,
  ovalCy: number,
  ovalRx: number,
  ovalRy: number,
): number[][] {
  const zoneX = Math.round(ovalCx - ovalRx + zone.x * 2 * ovalRx);
  const zoneY = Math.round(ovalCy - ovalRy + zone.y * 2 * ovalRy);
  const zoneW = Math.round(zone.w * 2 * ovalRx);
  const zoneH = Math.round(zone.h * 2 * ovalRy);
  const w = imageData.width;
  const data = imageData.data;
  const grid: number[][] = [];
  for (let y = zoneY; y < zoneY + zoneH && y < imageData.height; y++) {
    const row: number[] = [];
    for (let x = zoneX; x < zoneX + zoneW && x < w; x++) {
      if (x < 0 || y < 0) {
        row.push(0);
        continue;
      }
      const i = (y * w + x) * 4;
      row.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    if (row.length > 0) grid.push(row);
  }
  return grid;
}

function computeBaseline(allPixels: Pixel[]): Baseline {
  if (allPixels.length === 0) {
    return { meanL: 60, meanA: 10, meanB: 20, sdL: 5, sdA: 3, sdB: 3 };
  }
  const labs = allPixels.map((p) => rgbToLab(p.r, p.g, p.b));
  const Ls = labs.map((l) => l.L);
  const As = labs.map((l) => l.a);
  const Bs = labs.map((l) => l.b);
  return {
    meanL: trimmedMean(Ls),
    meanA: trimmedMean(As),
    meanB: trimmedMean(Bs),
    sdL: trimmedSD(Ls),
    sdA: trimmedSD(As),
    sdB: trimmedSD(Bs),
  };
}

function analyzeUniformity(pixels: Pixel[], baseline: Baseline): number {
  if (pixels.length === 0) return 50;
  const labs = pixels.map((p) => rgbToLab(p.r, p.g, p.b));
  const sdL = trimmedSD(labs.map((l) => l.L));
  const refSD = Math.max(3, baseline.sdL);
  const uniformL = Math.max(0, 100 - (sdL / refSD) * 30);
  const sdA = trimmedSD(labs.map((l) => l.a));
  const uniformA = Math.max(0, 100 - sdA * 3);
  const sdB = trimmedSD(labs.map((l) => l.b));
  const uniformB = Math.max(0, 100 - sdB * 2.5);
  return Math.max(0, Math.min(100, uniformL * 0.5 + uniformA * 0.3 + uniformB * 0.2));
}

function analyzeRedness(pixels: Pixel[], baseline: Baseline): number {
  if (pixels.length === 0) return 50;
  const labs = pixels.map((p) => rgbToLab(p.r, p.g, p.b));
  const As = labs.map((l) => l.a);
  const meanA = trimmedMean(As);
  const redShift = Math.max(0, meanA - baseline.meanA);
  const redThreshold = baseline.meanA + Math.max(3, baseline.sdA * 1.5);
  const redCount = As.filter((a) => a > redThreshold).length;
  const redRatio = redCount / As.length;
  const sdA = trimmedSD(As);
  const shiftScore = Math.max(0, 100 - redShift * 6);
  const ratioScore = Math.max(0, 100 - redRatio * 250);
  const varianceScore = Math.max(0, 100 - sdA * 3);
  return Math.max(0, Math.min(100, shiftScore * 0.4 + ratioScore * 0.35 + varianceScore * 0.25));
}

function analyzeTexture(grid: number[][]): number {
  if (!grid || grid.length < 5 || !grid[0] || grid[0].length < 5) return 50;
  const rows = grid.length;
  const cols = grid[0].length;
  let sobelSum = 0;
  let sobelCount = 0;
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const gx =
        -grid[y - 1][x - 1] +
        grid[y - 1][x + 1] +
        -2 * grid[y][x - 1] +
        2 * grid[y][x + 1] +
        -grid[y + 1][x - 1] +
        grid[y + 1][x + 1];
      const gy =
        -grid[y - 1][x - 1] -
        2 * grid[y - 1][x] -
        grid[y - 1][x + 1] +
        grid[y + 1][x - 1] +
        2 * grid[y + 1][x] +
        grid[y + 1][x + 1];
      sobelSum += Math.sqrt(gx * gx + gy * gy);
      sobelCount++;
    }
  }
  const avgSobel = sobelCount > 0 ? sobelSum / sobelCount : 0;
  const sobelScore = Math.max(0, 100 - avgSobel * 2.0);
  let adjDiffSum = 0;
  let adjCount = 0;
  const step = Math.max(1, Math.floor(Math.min(rows, cols) / 40));
  for (let y = 0; y < rows; y += step) {
    for (let x = 0; x < cols - 1; x += step) {
      adjDiffSum += Math.abs(grid[y][x] - grid[y][x + 1]);
      adjCount++;
    }
  }
  for (let y = 0; y < rows - 1; y += step) {
    for (let x = 0; x < cols; x += step) {
      adjDiffSum += Math.abs(grid[y][x] - grid[y + 1][x]);
      adjCount++;
    }
  }
  const avgAdj = adjCount > 0 ? adjDiffSum / adjCount : 0;
  const smoothScore = Math.max(0, 100 - avgAdj * 3.0);
  return Math.max(0, Math.min(100, sobelScore * 0.55 + smoothScore * 0.45));
}

function analyzePigmentation(pixels: Pixel[], baseline: Baseline): number {
  if (pixels.length === 0) return 50;
  const labs = pixels.map((p) => rgbToLab(p.r, p.g, p.b));
  const Ls = labs.map((l) => l.L);
  const Bs = labs.map((l) => l.b);
  const darkThreshold = baseline.meanL - 1.8 * Math.max(2, baseline.sdL);
  const darkPixels = Ls.filter((l) => l < darkThreshold);
  const darkRatio = darkPixels.length / Ls.length;
  const darkDepth =
    darkPixels.length > 0
      ? darkPixels.reduce((s, l) => s + (darkThreshold - l), 0) / darkPixels.length
      : 0;
  const meanB = trimmedMean(Bs);
  const yellowShift = Math.max(0, meanB - baseline.meanB - 3);
  const darkScore = Math.max(0, 100 - darkRatio * 350 - darkDepth * 3);
  const yellowScore = Math.max(0, 100 - yellowShift * 8);
  return Math.max(0, Math.min(100, darkScore * 0.65 + yellowScore * 0.35));
}

function analyzeFirmness(
  leftPixels: Pixel[],
  rightPixels: Pixel[],
  underEyeLPixels: Pixel[],
  underEyeRPixels: Pixel[],
  baseline: Baseline,
): number {
  if (leftPixels.length === 0 || rightPixels.length === 0) return 50;
  const avgLab = (px: Pixel[]): Lab => {
    if (px.length === 0) return { L: baseline.meanL, a: baseline.meanA, b: baseline.meanB };
    const labs = px.map((p) => rgbToLab(p.r, p.g, p.b));
    return {
      L: trimmedMean(labs.map((l) => l.L)),
      a: trimmedMean(labs.map((l) => l.a)),
      b: trimmedMean(labs.map((l) => l.b)),
    };
  };
  const leftLab = avgLab(leftPixels);
  const rightLab = avgLab(rightPixels);
  const deltaE = Math.sqrt(
    (leftLab.L - rightLab.L) ** 2 +
      (leftLab.a - rightLab.a) ** 2 +
      (leftLab.b - rightLab.b) ** 2,
  );
  const symmetryScore = Math.max(0, 100 - deltaE * 5);
  let eyeScore = 100;
  if (underEyeLPixels.length > 0 && underEyeRPixels.length > 0) {
    const eyeL = avgLab(underEyeLPixels);
    const eyeR = avgLab(underEyeRPixels);
    const cheekAvgL = (leftLab.L + rightLab.L) / 2;
    const eyeAvgL = (eyeL.L + eyeR.L) / 2;
    const eyeDarkness = Math.max(0, cheekAvgL - eyeAvgL);
    eyeScore = Math.max(0, 100 - eyeDarkness * 4);
  }
  const leftLs = leftPixels.map((p) => rgbToLab(p.r, p.g, p.b).L);
  const rightLs = rightPixels.map((p) => rgbToLab(p.r, p.g, p.b).L);
  const sdDiff = Math.abs(trimmedSD(leftLs) - trimmedSD(rightLs));
  const distScore = Math.max(0, 100 - sdDiff * 5);
  return Math.max(0, Math.min(100, symmetryScore * 0.45 + eyeScore * 0.35 + distScore * 0.2));
}

function analyzeMoisture(tZonePixels: Pixel[], uZonePixels: Pixel[], baseline: Baseline): number {
  if (tZonePixels.length === 0 && uZonePixels.length === 0) return 50;
  const allPx = [...tZonePixels, ...uZonePixels];
  const labs = allPx.map((p) => rgbToLab(p.r, p.g, p.b));
  const Ls = labs.map((l) => l.L);
  const shinyThreshold = baseline.meanL + Math.max(15, baseline.sdL * 2.5);
  const shinyCount = Ls.filter((l) => l > shinyThreshold).length;
  const shinyRatio = shinyCount / Ls.length;
  const oilScore = Math.max(0, 100 - shinyRatio * 300);
  const sdL = trimmedSD(Ls);
  const dryScore = Math.max(0, 100 - Math.max(0, sdL - baseline.sdL) * 5);
  let balanceScore = 100;
  if (tZonePixels.length > 0 && uZonePixels.length > 0) {
    const tLabs = tZonePixels.map((p) => rgbToLab(p.r, p.g, p.b));
    const uLabs = uZonePixels.map((p) => rgbToLab(p.r, p.g, p.b));
    const tMeanL = trimmedMean(tLabs.map((l) => l.L));
    const uMeanL = trimmedMean(uLabs.map((l) => l.L));
    const zoneDiff = Math.abs(tMeanL - uMeanL);
    balanceScore = Math.max(0, 100 - zoneDiff * 3);
  }
  return Math.max(0, Math.min(100, oilScore * 0.35 + dryScore * 0.3 + balanceScore * 0.35));
}

function gradeFromScore(score: number): SkinGrade {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 45) return 'caution';
  return 'warning';
}

export function runSkinAnalysis(
  imageData: ImageData,
  canvasW: number,
  canvasH: number,
): SkinAnalysisResult {
  const corrected = whiteBalance(imageData);
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const rx = canvasW * 0.32;
  const ry = canvasH * 0.42;

  const zonePixels: Partial<Record<FaceZone['key'], Pixel[]>> = {};
  for (const z of FACE_ZONES) {
    zonePixels[z.key] = getPixelsInZone(corrected, z, cx, cy, rx, ry);
  }
  const allPixels = Object.values(zonePixels).flat() as Pixel[];
  const baseline = computeBaseline(allPixels);

  const bothCheeks = [...(zonePixels.leftCheek ?? []), ...(zonePixels.rightCheek ?? [])];
  const tZone = [...(zonePixels.forehead ?? []), ...(zonePixels.nose ?? [])];
  const leftCheekZone = FACE_ZONES.find((z) => z.key === 'leftCheek');
  const cheekGrid = leftCheekZone
    ? getPixelGrid(corrected, leftCheekZone, cx, cy, rx, ry)
    : [];

  const uniformityScore = analyzeUniformity(allPixels, baseline);
  const rednessScore = analyzeRedness(allPixels, baseline);
  const textureScore = analyzeTexture(cheekGrid);
  const pigmentScore = analyzePigmentation(allPixels, baseline);
  const firmnessScore = analyzeFirmness(
    zonePixels.leftCheek ?? [],
    zonePixels.rightCheek ?? [],
    zonePixels.underEyeL ?? [],
    zonePixels.underEyeR ?? [],
    baseline,
  );
  const moistureScore = analyzeMoisture(tZone, bothCheeks, baseline);

  const scores: Record<SkinMetricKey, number> = {
    uniformity: uniformityScore,
    redness: rednessScore,
    texture: textureScore,
    pigment: pigmentScore,
    firmness: firmnessScore,
    moisture: moistureScore,
  };

  const metrics = {} as Record<SkinMetricKey, SkinMetric>;
  for (const k of Object.keys(scores) as SkinMetricKey[]) {
    const s = Math.round(scores[k]);
    metrics[k] = { score: s, grade: gradeFromScore(s) };
  }

  const totalScore = Math.round(
    (Object.values(metrics) as SkinMetric[]).reduce((sum, m) => sum + m.score, 0) /
      Object.keys(metrics).length,
  );

  return { metrics, totalScore, timestamp: new Date().toISOString() };
}

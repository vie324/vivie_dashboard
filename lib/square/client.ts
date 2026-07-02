import { Client, Environment } from 'square';

let cached: Client | null = null;

export function squareClient(): Client {
  if (cached) return cached;
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('SQUARE_ACCESS_TOKEN is not set');
  }
  // タイポで本番課金データに触れないよう、値を厳密に検証する
  const envRaw = (process.env.SQUARE_ENVIRONMENT ?? 'production').trim().toLowerCase();
  if (envRaw !== 'production' && envRaw !== 'sandbox') {
    throw new Error(
      `SQUARE_ENVIRONMENT が不正です: "${envRaw}" (production または sandbox を指定してください)`,
    );
  }
  cached = new Client({
    bearerAuthCredentials: { accessToken: token },
    environment: envRaw === 'sandbox' ? Environment.Sandbox : Environment.Production,
    userAgentDetail: 'vivie-dashboard',
  });
  return cached;
}

export function squareLocationIds(): string[] {
  const raw = process.env.SQUARE_LOCATION_IDS ?? '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// Square SDK の Money は BigInt。JSON レスポンスに載せる前に number へ変換する
// (JPY は最小通貨単位が円のため Number.MAX_SAFE_INTEGER を超えることは実務上ない)。
export function safeJson(value: unknown): any {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)),
  );
}

// Square SDK のエラーから人間に分かりやすいメッセージを抽出
export function describeSquareError(err: unknown, step: string): string {
  const e = err as any;
  if (Array.isArray(e?.errors) && e.errors.length > 0) {
    const first = e.errors[0];
    return `[${step}] ${first.category ?? ''} ${first.code ?? ''}: ${first.detail ?? first.message ?? ''}`;
  }
  if (e?.result?.errors?.[0]) {
    const first = e.result.errors[0];
    return `[${step}] ${first.category ?? ''} ${first.code ?? ''}: ${first.detail ?? first.message ?? ''}`;
  }
  if (e?.message) return `[${step}] ${e.message}`;
  return `[${step}] unknown error`;
}

// サブスクプランの課金周期 → 月額換算係数。
// MRR (月次経常収益) をプラン価格 × この係数で正規化する。
const CADENCE_MONTHLY_FACTOR: Record<string, number> = {
  WEEKLY: 52 / 12,
  EVERY_TWO_WEEKS: 26 / 12,
  THIRTY_DAYS: 1,
  MONTHLY: 1,
  SIXTY_DAYS: 1 / 2,
  EVERY_TWO_MONTHS: 1 / 2,
  NINETY_DAYS: 1 / 3,
  QUARTERLY: 1 / 3,
  EVERY_FOUR_MONTHS: 1 / 4,
  EVERY_SIX_MONTHS: 1 / 6,
  ANNUAL: 1 / 12,
  EVERY_TWO_YEARS: 1 / 24,
};

export function monthlyEquivalent(price: number, cadence: string | null | undefined): number {
  const factor = cadence ? CADENCE_MONTHLY_FACTOR[cadence] ?? 1 : 1;
  return Math.round(price * factor);
}

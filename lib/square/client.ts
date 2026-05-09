import { Client, Environment } from 'square';

let cached: Client | null = null;

export function squareClient(): Client {
  if (cached) return cached;
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('SQUARE_ACCESS_TOKEN is not set');
  }
  const env = process.env.SQUARE_ENVIRONMENT === 'sandbox'
    ? Environment.Sandbox
    : Environment.Production;
  cached = new Client({
    accessToken: token,
    environment: env,
    userAgentDetail: 'vivie-dashboard',
  });
  return cached;
}

export function squareLocationIds(): string[] {
  const raw = process.env.SQUARE_LOCATION_IDS ?? '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// Square SDK は BigInt を使う。JSON にする際は文字列化が必要。
export function safeJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)),
  );
}

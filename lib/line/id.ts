// LINE の宛先 ID (userId / groupId / roomId) の正規化・検証。
// サーバー専用の依存を持たないため、クライアントコンポーネントからも import 可能。
//
// LINE の userId は "U" + 32 桁の 16 進数。group は "C"、room は "R" プレフィックス。
// (例: Udeadbeef... の計 33 文字)
// 保存時に前後の空白・改行が混入すると LINE Push API が
// 「The property, 'to', in the request body is invalid」を返すため、
// 送信前に trim + 形式チェックする。

const LINE_ID_RE = /^[URC][0-9a-fA-F]{32}$/;

// trim した上で正しい形式なら正規化済みの ID を、不正なら null を返す。
export function normalizeLineTarget(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return LINE_ID_RE.test(trimmed) ? trimmed : null;
}

export function isValidLineTarget(raw: string | null | undefined): boolean {
  return normalizeLineTarget(raw) !== null;
}

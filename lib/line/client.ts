// LINE Messaging API クライアント
// Channel access token + secret は Vercel 環境変数から読み込む

const LINE_API = 'https://api.line.me/v2/bot';

export function lineConfigured(): boolean {
  return !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

export async function pushMessage(
  to: string,
  messages: any[],
): Promise<{ ok: true; requestId: string | null } | { ok: false; error: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN が未設定です' };

  const res = await fetch(`${LINE_API}/message/push`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `LINE API ${res.status}: ${body}` };
  }
  return { ok: true, requestId: res.headers.get('x-line-request-id') };
}

export async function getProfile(
  userId: string,
): Promise<{ displayName: string; pictureUrl?: string } | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${LINE_API}/profile/${userId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

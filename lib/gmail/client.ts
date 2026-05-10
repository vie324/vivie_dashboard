// Gmail API クライアント (fetch ベース)
// refresh_token を使って access_token を都度発行

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

export interface GmailMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPayload;
  snippet?: string;
}

export interface GmailPayload {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { size?: number; data?: string };
  parts?: GmailPayload[];
}

export class GmailClient {
  private accessToken: string | null = null;
  private accessTokenExpiry = 0;

  constructor(
    private readonly refreshToken: string,
    private readonly clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!,
    private readonly clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
  ) {}

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiry - 30_000) {
      return this.accessToken;
    }
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`token refresh failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.accessTokenExpiry = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  async api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${GMAIL_API}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`gmail ${path} ${res.status}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  // 新規メッセージ ID の差分取得
  async historyList(startHistoryId: string): Promise<string[]> {
    const messageIds = new Set<string>();
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        startHistoryId,
        historyTypes: 'messageAdded',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const res = await this.api<{
        history?: { messages?: { id: string }[]; messagesAdded?: { message: { id: string } }[] }[];
        nextPageToken?: string;
      }>(`/users/me/history?${params.toString()}`);
      for (const h of res.history ?? []) {
        for (const m of h.messages ?? []) messageIds.add(m.id);
        for (const m of h.messagesAdded ?? []) messageIds.add(m.message.id);
      }
      pageToken = res.nextPageToken;
    } while (pageToken);
    return Array.from(messageIds);
  }

  async getMessage(id: string): Promise<GmailMessage> {
    return this.api<GmailMessage>(`/users/me/messages/${id}?format=full`);
  }

  async getProfile(): Promise<{ emailAddress: string; historyId: string }> {
    return this.api(`/users/me/profile`);
  }

  // Gmail watch: Pub/Sub に通知を送らせる (要: Cloud Pub/Sub の topic に gmail-api-push@system.gserviceaccount.com に publisher 権限)
  async watch(topicName: string, labelIds?: string[]) {
    return this.api<{ historyId: string; expiration: string }>(`/users/me/watch`, {
      method: 'POST',
      body: JSON.stringify({
        topicName,
        labelIds,
        labelFilterAction: labelIds && labelIds.length > 0 ? 'include' : undefined,
      }),
    });
  }

  async stopWatch() {
    return this.api(`/users/me/stop`, { method: 'POST' });
  }
}

// メッセージ payload からプレーンテキスト本文を取り出す
export function extractTextBody(payload: GmailPayload | undefined): string {
  if (!payload) return '';
  function decode(data: string | undefined) {
    if (!data) return '';
    // base64url → utf8
    try {
      const buf = Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      return buf.toString('utf-8');
    } catch {
      return '';
    }
  }
  function walk(p: GmailPayload): string | null {
    if (p.mimeType === 'text/plain' && p.body?.data) return decode(p.body.data);
    if (p.parts) {
      // text/plain を優先
      for (const part of p.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) return decode(part.body.data);
      }
      for (const part of p.parts) {
        const inner = walk(part);
        if (inner) return inner;
      }
    }
    if (p.mimeType === 'text/html' && p.body?.data) {
      const html = decode(p.body.data);
      // 簡易タグ除去
      return html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
    }
    return null;
  }
  return walk(payload) ?? '';
}

export function getHeader(payload: GmailPayload | undefined, name: string): string | null {
  if (!payload?.headers) return null;
  const h = payload.headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

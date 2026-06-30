import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatYen(value: number | null | undefined): string {
  if (value == null) return '¥0';
  return `¥${Math.round(value).toLocaleString('ja-JP')}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// サロンは JST 運用のため、サーバー (Vercel = UTC) でもクライアントでも
// 必ず日本時間 (UTC+9, 日本は DST 無し) の暦日に揃える。
// getTimezoneOffset を使うと UTC サーバー上で UTC 日付になり、深夜帯の売上/日報が
// 前日にズレて「今月の数字に反映されない」原因になっていた。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function todayISO(): string {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export function ymd(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

// ISO タイムスタンプ (UTC) を JST の暦日 (YYYY-MM-DD) に変換する。
// Square の created_at など UTC タイムスタンプを出納帳の entry_date に使う際に利用。
export function jstDateFromISO(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return todayISO();
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

// 今月 (JST) を YYYY-MM で返す
export function thisMonthJST(): string {
  return todayISO().slice(0, 7);
}

// 月文字列 (YYYY-MM) から、その月の範囲を返す。
// 末日を `${month}-31` のように決め打ちすると、30 日月や 2 月で
// 不正な日付 (例: 2026-06-31) になり、Postgres が
// 「date/time field value out of range」でクエリ全体を失敗させてしまう。
// (= 出納帳・勤怠の数字が「反映されない」原因)
// 半開区間 [start, endExclusive) で扱うことでこれを回避する。
export function monthRange(month: string): {
  start: string; // YYYY-MM-01
  endExclusive: string; // 翌月初日 YYYY-MM-01
  endInclusive: string; // その月の末日 YYYY-MM-DD
} {
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  // Date.UTC は月が 0 始まり。引数の m は 1 始まりなので、そのまま渡すと「翌月」になる。
  const endExclusive = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // 翌月 0 日 = 当月末日
  const endInclusive = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { start, endExclusive, endInclusive };
}

export function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// アプリの公開 URL を解決する。本番で NEXT_PUBLIC_APP_URL 未設定でも
// Vercel の自動 URL / クライアントの origin にフォールバックして
// localhost への誤リダイレクト・壊れた共有 URL を防ぐ。
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}

// 「苗字 名前」順で連結
export function joinJaName(
  familyName?: string | null,
  givenName?: string | null,
  fallback?: string | null,
): string {
  return (
    [familyName, givenName].filter(Boolean).join(' ').trim() || fallback || '名前未設定'
  );
}

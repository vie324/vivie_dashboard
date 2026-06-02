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

export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function ymd(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
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

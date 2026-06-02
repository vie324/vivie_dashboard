export interface CsvColumn<T> {
  key: string;
  label: string;
  value?: (row: T) => string | number | null | undefined;
}

// 行配列を CSV 文字列に変換する。カンマ・改行・引用符を適切にエスケープ。
export function toCsv<T extends Record<string, any>>(rows: T[], columns: CsvColumn<T>[]): string {
  const escape = (v: any): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escape(c.value ? c.value(row) : row[c.key])).join(','),
  );
  return [header, ...lines].join('\r\n');
}

// CSV をダウンロードさせる。Excel で文字化けしないよう BOM 付き UTF-8。
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

'use client';
import { Printer } from 'lucide-react';
import { Button } from './button';

// ブラウザの印刷機能を呼び出す。印刷ダイアログから「PDF に保存」で
// カルテ / 施術記録を PDF 化できる (追加ライブラリ不要)。
export function PrintButton({ label = '印刷 / PDF' }: { label?: string }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()} className="print:hidden">
      <Printer size={14} />
      {label}
    </Button>
  );
}

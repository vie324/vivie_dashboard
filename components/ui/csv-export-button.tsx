'use client';
import { Download } from 'lucide-react';
import { Button } from './button';
import { toCsv, downloadCsv, type CsvColumn } from '@/lib/csv';

interface Props<T extends Record<string, any>> {
  filename: string;
  rows: T[];
  columns: CsvColumn<T>[];
  label?: string;
}

export function CsvExportButton<T extends Record<string, any>>({
  filename,
  rows,
  columns,
  label = 'CSV',
}: Props<T>) {
  function handle() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`${filename}_${stamp}.csv`, toCsv(rows, columns));
  }
  return (
    <Button size="sm" variant="secondary" onClick={handle} disabled={rows.length === 0}>
      <Download size={14} />
      {label}
    </Button>
  );
}

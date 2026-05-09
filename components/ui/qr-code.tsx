'use client';
import { useState } from 'react';
import { Modal } from './modal';
import { CopyButton } from './copy-button';
import { QrCode } from 'lucide-react';

// シンプルな QR コード生成: api.qrserver.com (依存ライブラリ追加なしで動作)
function qrUrl(text: string, size = 320) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}

export function QrCodeButton({ value, label }: { value: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-1.5 text-ink-500 hover:bg-vivie-100 hover:text-vivie-600"
        aria-label="QR コードを表示"
        title="QR コードを表示"
      >
        <QrCode size={14} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={label ?? 'QR コード'} size="sm">
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl(value, 320)}
            alt="QR code"
            className="rounded-lg border border-ink-100"
            width={320}
            height={320}
          />
          <div className="flex items-center gap-2 w-full">
            <code className="flex-1 truncate rounded-md bg-ink-50 px-2 py-1.5 text-xs font-mono text-ink-700">
              {value}
            </code>
            <CopyButton value={value} />
          </div>
          <p className="text-xs text-ink-500 text-center">
            スマートフォンのカメラでスキャンしてアクセスできます
          </p>
        </div>
      </Modal>
    </>
  );
}

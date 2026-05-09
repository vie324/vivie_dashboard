'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  bucket?: string;
  pathPrefix: string;
  value: string | null;
  onChange: (path: string | null) => void;
}

export function PhotoUploader({ label, bucket = 'treatment-photos', pathPrefix, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // 既存パスから署名付き URL を発行
  async function loadPreview(path: string) {
    const supabase = createClient();
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (data?.signedUrl) setPreview(data.signedUrl);
  }

  if (value && !preview) loadPreview(value);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);
      onChange(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!value) return;
    if (!confirm('写真を削除しますか?')) return;
    try {
      const supabase = createClient();
      await supabase.storage.from(bucket).remove([value]);
    } catch {
      // 既に消えている場合は無視
    }
    setPreview(null);
    onChange(null);
  }

  return (
    <div>
      <p className="text-xs font-medium text-ink-500 mb-1.5">{label}</p>
      <div
        className={cn(
          'relative aspect-[4/3] w-full rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/40 overflow-hidden',
          preview && 'border-solid border-vivie-200',
        )}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={label} className="absolute inset-0 h-full w-full object-cover" />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 rounded-full bg-white/90 p-1.5 shadow hover:bg-white"
              aria-label="削除"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <label className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-vivie-50/40">
            {uploading ? (
              <Loader2 className="text-vivie-500 animate-spin" size={28} />
            ) : (
              <>
                <ImageIcon className="text-ink-300" size={28} />
                <span className="text-xs text-ink-500 inline-flex items-center gap-1.5">
                  <Upload size={12} />
                  クリックまたはドロップで選択
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </label>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

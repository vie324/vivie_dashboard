'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoreRadar } from './radar-chart';
import { SKIN_AXES, FACE_AXES, avgScore } from '@/lib/treatment-axes';
import { ImageOff } from 'lucide-react';

interface ReportLike {
  skin_scores: Record<string, number>;
  face_scores: Record<string, number>;
  before_photo_path: string | null;
  after_photo_path: string | null;
}

export function TreatmentDetailView({
  report,
  previous,
}: {
  report: ReportLike;
  previous: ReportLike | null;
}) {
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      if (report.before_photo_path) {
        const { data } = await supabase.storage
          .from('treatment-photos')
          .createSignedUrl(report.before_photo_path, 3600);
        if (data?.signedUrl) setBeforeUrl(data.signedUrl);
      }
      if (report.after_photo_path) {
        const { data } = await supabase.storage
          .from('treatment-photos')
          .createSignedUrl(report.after_photo_path, 3600);
        if (data?.signedUrl) setAfterUrl(data.signedUrl);
      }
    }
    load();
  }, [report.before_photo_path, report.after_photo_path]);

  return (
    <>
      {(report.before_photo_path || report.after_photo_path) && (
        <Card>
          <CardHeader>
            <CardTitle>Before / After</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PhotoView label="施術前" url={beforeUrl} hasPath={!!report.before_photo_path} />
            <PhotoView label="施術後" url={afterUrl} hasPath={!!report.after_photo_path} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ScoreCard
          title="肌"
          axes={SKIN_AXES}
          current={report.skin_scores}
          previous={previous?.skin_scores ?? null}
        />
        <ScoreCard
          title="顔"
          axes={FACE_AXES}
          current={report.face_scores}
          previous={previous?.face_scores ?? null}
        />
      </div>
    </>
  );
}

function PhotoView({
  label,
  url,
  hasPath,
}: {
  label: string;
  url: string | null;
  hasPath: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-500 mb-1.5">{label}</p>
      <div className="aspect-[4/3] w-full rounded-xl border border-ink-100 bg-ink-50/40 overflow-hidden flex items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : hasPath ? (
          <p className="text-xs text-ink-400">読み込み中…</p>
        ) : (
          <div className="text-ink-300 flex flex-col items-center gap-1.5">
            <ImageOff size={24} />
            <span className="text-xs">写真なし</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({
  title,
  axes,
  current,
  previous,
}: {
  title: string;
  axes: typeof SKIN_AXES;
  current: Record<string, number>;
  previous: Record<string, number> | null;
}) {
  const avg = avgScore(axes, current);
  const prevAvg = previous ? avgScore(axes, previous) : 0;
  const diff = avg - prevAvg;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-serif text-2xl font-semibold text-vivie-600">{avg}</span>
          <span className="text-xs text-ink-400">/ 5</span>
          {previous && (
            <span
              className={`text-xs font-medium ml-2 ${
                diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-amber-600' : 'text-ink-400'
              }`}
            >
              {diff > 0 ? '+' : ''}
              {diff.toFixed(1)} (前回比)
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScoreRadar axes={axes} current={current ?? {}} previous={previous} height={240} />
      </CardContent>
    </Card>
  );
}

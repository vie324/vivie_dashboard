'use client';
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Upload,
  RefreshCw,
  Loader2,
  Sun,
  Glasses,
  Scan,
  Smile,
  AlertCircle,
} from 'lucide-react';
import {
  runSkinAnalysis,
  SKIN_METRIC_DEFS,
  SKIN_GRADE_DEFS,
  type SkinAnalysisResult,
  type SkinGrade,
  type SkinMetricKey,
} from '@/lib/skin-analysis';
import { cn } from '@/lib/utils';

type Phase = 'start' | 'camera' | 'analyzing' | 'results';

const GRADE_TONE: Record<SkinGrade, 'green' | 'amber' | 'red'> = {
  excellent: 'green',
  good: 'green',
  caution: 'amber',
  warning: 'red',
};

export function SkinAnalyzerView() {
  const [phase, setPhase] = useState<Phase>('start');
  const [result, setResult] = useState<SkinAnalysisResult | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function startCamera() {
    setError('');
    setPhase('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('camera error', err);
      setError('カメラを起動できませんでした。写真をアップロードしてください。');
      setPhase('start');
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // プレビューを scaleX(-1) でミラーしているので撮影画像も同じ向きにする
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    stopCamera();
    processCanvas(canvas);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhase('analyzing');
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current ?? document.createElement('canvas');
      // 大きすぎる画像は計算量を抑えるため最大 1024px に縮小
      const maxSide = 1024;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('画像を描画できませんでした');
        setPhase('start');
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      processCanvas(canvas);
    };
    img.onerror = () => {
      setError('画像を読み込めませんでした');
      setPhase('start');
    };
    img.src = URL.createObjectURL(file);
  }

  function processCanvas(canvas: HTMLCanvasElement) {
    setPhase('analyzing');
    setImageDataUrl(canvas.toDataURL('image/jpeg', 0.8));
    // UI 更新を先に走らせるため一旦次フレームへ譲る
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('canvas context unavailable');
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const r = runSkinAnalysis(imageData, canvas.width, canvas.height);
          setResult(r);
          setPhase('results');
        } catch (err) {
          console.error('analysis error', err);
          setError('分析中にエラーが発生しました: ' + (err instanceof Error ? err.message : ''));
          setPhase('start');
        }
      }, 300);
    });
  }

  function handleRetry() {
    stopCamera();
    setPhase('start');
    setResult(null);
    setImageDataUrl(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  useEffect(() => () => stopCamera(), []);

  if (phase === 'camera') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>カメラで撮影</CardTitle>
          <p className="mt-1 text-xs text-ink-500">
            楕円のガイドに顔を合わせて撮影してください
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-ink-900 aspect-[4/3]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <ellipse
                cx="50"
                cy="50"
                rx="32"
                ry="42"
                fill="none"
                stroke="#fff"
                strokeWidth="0.5"
                strokeDasharray="2 1.5"
                opacity="0.7"
              />
            </svg>
          </div>
          <div className="flex justify-center gap-2">
            <Button onClick={capturePhoto} size="lg">
              <Camera size={16} />
              撮影
            </Button>
            <Button variant="ghost" onClick={handleRetry}>
              キャンセル
            </Button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>
    );
  }

  if (phase === 'analyzing') {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-4">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-vivie-500" />
          <p className="text-sm text-ink-600">画像を解析しています…</p>
          {imageDataUrl && (
            <img
              src={imageDataUrl}
              alt="解析中"
              className="mx-auto max-w-xs rounded-2xl opacity-70"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>
    );
  }

  if (phase === 'results' && result) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            {imageDataUrl && (
              <img
                src={imageDataUrl}
                alt="解析画像"
                className="h-24 w-24 rounded-2xl object-cover border border-ink-100"
              />
            )}
            <div className="flex-1">
              <p className="text-xs text-ink-500">総合スコア</p>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-4xl font-semibold text-vivie-600">
                  {result.totalScore}
                </span>
                <span className="text-sm text-ink-500">/ 100</span>
              </div>
              <p className="mt-0.5 text-[10px] text-ink-400">
                {new Date(result.timestamp).toLocaleString('ja-JP')}
              </p>
            </div>
            <Button variant="secondary" onClick={handleRetry}>
              <RefreshCw size={14} />
              もう一度
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SKIN_METRIC_DEFS.map((def) => {
            const m = result.metrics[def.key as SkinMetricKey];
            const grade = SKIN_GRADE_DEFS[m.grade];
            return (
              <Card key={def.key}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{def.label}</p>
                      <p className="text-[10px] text-ink-400">{def.desc}</p>
                    </div>
                    <Badge tone={GRADE_TONE[m.grade]}>{grade.label}</Badge>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-serif text-2xl font-semibold text-ink-900">
                      {m.score}
                    </span>
                    <span className="text-xs text-ink-400">/ 100</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        m.grade === 'excellent' && 'bg-emerald-400',
                        m.grade === 'good' && 'bg-lime-400',
                        m.grade === 'caution' && 'bg-amber-400',
                        m.grade === 'warning' && 'bg-red-400',
                      )}
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-center text-[10px] text-ink-400">
          ※ 簡易解析のためカウンセリング補助としてご利用ください
        </p>
      </div>
    );
  }

  // phase === 'start'
  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="text-center">
          <Scan className="mx-auto h-10 w-10 text-vivie-500" />
          <h2 className="mt-3 font-serif text-xl font-semibold text-ink-900">肌分析</h2>
          <p className="mt-1 text-xs text-ink-500">
            カメラで撮影、または顔写真をアップロードすると、
            <br />
            6 項目の肌指標をスコア化します。
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <Button onClick={startCamera} size="lg" className="w-full">
            <Camera size={16} />
            カメラで撮影
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} />
            写真をアップロード
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        <div className="rounded-2xl bg-ink-50/60 border border-ink-100 p-4">
          <p className="text-[10px] font-semibold text-ink-500 mb-3">撮影のコツ</p>
          <ul className="space-y-2 text-xs text-ink-600">
            {[
              { icon: Sun, text: '自然光の下で撮影すると、より正確な分析ができます' },
              { icon: Glasses, text: 'メガネを外し、前髪は上げてください' },
              { icon: Scan, text: 'ガイドの楕円に顔を合わせてください' },
              { icon: Smile, text: 'リラックスした表情で正面を向いてください' },
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <tip.icon size={12} className="mt-0.5 shrink-0 text-vivie-500" />
                <span>{tip.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </CardContent>
    </Card>
  );
}

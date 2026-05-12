'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { QrCodeButton } from '@/components/ui/qr-code';
import { useToast } from '@/components/ui/toast';
import { ExternalLink, RefreshCw, FileBarChart2, MapPin, Sparkles } from 'lucide-react';

interface StaffRow {
  id: string;
  display_name: string;
  role: string;
  is_active: boolean;
  daily_report_token: string | null;
  primary_store?: { name: string } | null;
}

export function StaffUrlAdmin({
  staff,
  canManage,
}: {
  staff: StaffRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  // 店舗ロールはメールログイン用なので個人 URL 発行対象から除外
  const [items, setItems] = useState(staff.filter((s) => s.role !== 'store'));

  async function regenerateToken(id: string) {
    if (!confirm('URL を再発行しますか? 既存の URL は無効になります')) return;
    const supabase = createClient();
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const { error } = await supabase
      .from('staff')
      .update({ daily_report_token: newToken })
      .eq('id', id);
    if (error) {
      toast.show(error.message, 'error');
      return;
    }
    setItems((list) =>
      list.map((s) => (s.id === id ? { ...s, daily_report_token: newToken } : s)),
    );
    toast.show('URL を再発行しました', 'success');
    router.refresh();
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="p-4 space-y-3">
      <div className="rounded-xl bg-vivie-50/40 border border-vivie-100 px-4 py-3 text-sm text-vivie-700 mb-3">
        <p className="font-medium">スタッフ専用 URL の発行 / 共有</p>
        <p className="mt-1 text-xs text-vivie-600">
          各スタッフに 1 つのトークン URL を発行します。LINE 等で共有してください。
          スタッフはログイン不要でハブから「日報入力」「勤怠打刻」を行えます。
          打刻時の名前・スタッフ ID は自動でひも付きます。
        </p>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-ink-400 text-center py-8">
          スタッフが登録されていません。設定ページから追加してください。
        </p>
      )}

      {items.map((s) => {
        const hubUrl = s.daily_report_token ? `${baseUrl}/staff/${s.daily_report_token}` : '';
        const reportUrl = s.daily_report_token ? `${baseUrl}/staff/report/${s.daily_report_token}` : '';
        const attendanceUrl = s.daily_report_token ? `${baseUrl}/staff/attendance/${s.daily_report_token}` : '';

        return (
          <div key={s.id} className="rounded-2xl border border-ink-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink-900">{s.display_name}</p>
                <p className="text-xs text-ink-400">
                  {s.primary_store?.name ?? '店舗未設定'} ・ {s.role}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!s.is_active && <Badge tone="default">無効</Badge>}
                {canManage && s.daily_report_token && (
                  <Button
                    onClick={() => regenerateToken(s.id)}
                    variant="ghost"
                    size="sm"
                    title="再発行"
                  >
                    <RefreshCw size={14} />
                    再発行
                  </Button>
                )}
              </div>
            </div>

            {s.daily_report_token ? (
              <div className="space-y-2">
                <UrlRow
                  icon={<Sparkles size={14} className="text-vivie-500" />}
                  label="統合ハブ URL (推奨)"
                  url={hubUrl}
                  hint="日報・勤怠どちらにもアクセスできます"
                />
                <UrlRow
                  icon={<MapPin size={14} className="text-vivie-500" />}
                  label="勤怠打刻 直接リンク"
                  url={attendanceUrl}
                />
                <UrlRow
                  icon={<FileBarChart2 size={14} className="text-amber-600" />}
                  label="日報入力 直接リンク"
                  url={reportUrl}
                />
              </div>
            ) : (
              <Badge tone="amber">URL 未発行 (再発行ボタンで作成)</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UrlRow({
  icon,
  label,
  url,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  url: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/40 px-3 py-2">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-ink-700">{label}</span>
        {hint && <span className="text-[10px] text-ink-400">{hint}</span>}
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-white border border-ink-200 px-2.5 py-1.5 text-xs font-mono text-ink-700">
          {url}
        </code>
        <CopyButton value={url} />
        <QrCodeButton value={url} label={label} />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg p-1.5 text-ink-500 hover:bg-vivie-100 hover:text-vivie-600"
          aria-label="開く"
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

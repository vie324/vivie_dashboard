'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input, Select } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ClipboardList, Search } from 'lucide-react';
import { formatDate, formatYen } from '@/lib/utils';
import { SKIN_AXES, FACE_AXES, avgScore } from '@/lib/treatment-axes';

interface Report {
  id: string;
  treatment_date: string;
  menu: string | null;
  amount: number | null;
  is_first_visit: boolean;
  contracted: boolean;
  followup_offer: any | null;
  line_sent_at: string | null;
  skin_scores: any;
  face_scores: any;
  member?: { id: string; full_name: string; line_picture_url: string | null } | null;
  staff?: { id: string; display_name: string } | null;
  store?: { id: string; name: string } | null;
}

export function TreatmentsListView({
  reports,
  stores,
  staff,
}: {
  reports: Report[];
  stores: { id: string; name: string }[];
  staff: { id: string; display_name: string }[];
}) {
  const [query, setQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending_followup' | 'sent' | 'contracted' | 'first_visit'
  >('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (storeFilter && r.store?.id !== storeFilter) return false;
      if (staffFilter && r.staff?.id !== staffFilter) return false;
      if (statusFilter === 'first_visit' && !r.is_first_visit) return false;
      if (statusFilter === 'contracted' && !r.contracted) return false;
      if (statusFilter === 'sent' && !r.line_sent_at) return false;
      if (statusFilter === 'pending_followup') {
        if (!r.is_first_visit || r.contracted || r.line_sent_at) return false;
      }
      if (!q) return true;
      return (
        (r.member?.full_name ?? '').toLowerCase().includes(q) ||
        (r.menu ?? '').toLowerCase().includes(q)
      );
    });
  }, [reports, query, storeFilter, staffFilter, statusFilter]);

  // 集計
  const summary = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter(
      (r) => r.is_first_visit && !r.contracted && !r.line_sent_at,
    ).length;
    const sent = reports.filter((r) => r.line_sent_at).length;
    const contracted = reports.filter((r) => r.contracted).length;
    return { total, pending, sent, contracted };
  }, [reports]);

  return (
    <>
      {/* サマリ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="施術件数" value={`${summary.total}`} tone="default" />
        <SummaryStat label="フォロー未送信" value={`${summary.pending}`} tone="amber" />
        <SummaryStat label="LINE 送信済" value={`${summary.sent}`} tone="green" />
        <SummaryStat label="契約成立" value={`${summary.contracted}`} tone="rose" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="会員名・メニューで検索"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="min-w-[140px]"
              >
                <option value="all">全件</option>
                <option value="pending_followup">フォロー未送信</option>
                <option value="sent">LINE 送信済</option>
                <option value="contracted">契約成立</option>
                <option value="first_visit">初回来店のみ</option>
              </Select>
              <Select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="min-w-[120px]"
              >
                <option value="">全店舗</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="min-w-[120px]"
              >
                <option value="">全担当</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={<ClipboardList size={28} />} title="該当する施術レポートがありません" />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>会員</th>
                    <th>メニュー</th>
                    <th>担当</th>
                    <th className="text-right">肌</th>
                    <th className="text-right">顔</th>
                    <th>状況</th>
                    <th className="text-right">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const skin = avgScore(SKIN_AXES, r.skin_scores ?? {});
                    const face = avgScore(FACE_AXES, r.face_scores ?? {});
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap text-xs text-ink-500">
                          {formatDate(r.treatment_date)}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Avatar
                              name={r.member?.full_name ?? '?'}
                              src={r.member?.line_picture_url}
                              size="xs"
                            />
                            <Link
                              href={`/treatments/${r.id}`}
                              className="font-medium text-ink-900 hover:text-vivie-600"
                            >
                              {r.member?.full_name ?? '—'}
                            </Link>
                          </div>
                        </td>
                        <td className="text-xs text-ink-600 max-w-xs truncate">{r.menu ?? '—'}</td>
                        <td className="text-xs text-ink-500">{r.staff?.display_name ?? '—'}</td>
                        <td className="text-right">
                          {skin > 0 ? (
                            <span className="text-sm text-vivie-700">{skin}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="text-right">
                          {face > 0 ? (
                            <span className="text-sm text-amber-700">{face}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <StatusBadges report={r} />
                        </td>
                        <td className="text-right text-sm">
                          {r.amount ? formatYen(r.amount) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function StatusBadges({ report }: { report: Report }) {
  const badges = [];
  if (report.is_first_visit) badges.push({ label: '初回', tone: 'rose' as const });
  if (report.contracted) badges.push({ label: '契約', tone: 'green' as const });
  if (report.line_sent_at) badges.push({ label: 'LINE済', tone: 'blue' as const });
  if (report.is_first_visit && !report.contracted && !report.line_sent_at) {
    badges.push({ label: 'LINE未送信', tone: 'amber' as const });
  }
  if (badges.length === 0) return <span className="text-xs text-ink-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <Badge key={b.label} tone={b.tone} className="text-[10px]">
          {b.label}
        </Badge>
      ))}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'default' | 'rose' | 'amber' | 'green';
}) {
  const valueClass =
    tone === 'rose'
      ? 'text-vivie-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : tone === 'green'
          ? 'text-emerald-700'
          : 'text-ink-900';
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`mt-1 font-serif text-2xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

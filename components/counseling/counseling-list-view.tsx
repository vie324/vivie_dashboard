'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ClipboardList, Search, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import {
  SKIN_CONCERNS,
  FACE_CONCERNS,
  BODY_CONCERNS,
  GOAL_TIMELINES,
  MONTHLY_BUDGETS,
  labelOf,
  labelsOf,
} from '@/lib/counseling-options';

interface RecordRow {
  id: string;
  full_name: string;
  furigana: string | null;
  phone: string;
  submitted_at: string;
  skin_concerns: string[] | null;
  face_concerns: string[] | null;
  body_concerns: string[] | null;
  goal_timeline: string | null;
  monthly_budget: string | null;
  reviewed_at: string | null;
  store?: { name: string } | null;
}

export function CounselingListView({ records }: { records: RecordRow[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unreviewed' | 'reviewed'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (filter === 'unreviewed' && r.reviewed_at) return false;
      if (filter === 'reviewed' && !r.reviewed_at) return false;
      if (!q) return true;
      const allConcerns = [
        ...labelsOf(SKIN_CONCERNS, r.skin_concerns),
        ...labelsOf(FACE_CONCERNS, r.face_concerns),
        ...labelsOf(BODY_CONCERNS, r.body_concerns),
      ].join(' ');
      return (
        r.full_name.toLowerCase().includes(q) ||
        (r.furigana ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').includes(q) ||
        allConcerns.toLowerCase().includes(q)
      );
    });
  }, [records, query, filter]);

  const unreviewedCount = records.filter((r) => !r.reviewed_at).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="氏名・電話・悩みで検索"
            className="pl-9 h-10"
          />
        </div>
        <div className="inline-flex rounded-xl border border-ink-100 bg-white p-1">
          <FilterButton
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label={`全て (${records.length})`}
          />
          <FilterButton
            active={filter === 'unreviewed'}
            onClick={() => setFilter('unreviewed')}
            label={`未確認 (${unreviewedCount})`}
            tone="amber"
          />
          <FilterButton
            active={filter === 'reviewed'}
            onClick={() => setFilter('reviewed')}
            label="確認済"
            tone="green"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<ClipboardList size={28} />}
              title={records.length === 0 ? 'まだカウンセリングが提出されていません' : '該当する記録が見つかりません'}
              description={
                records.length === 0
                  ? '公開フォームをお客様にお渡しいただくか、「新規入力」から手動で記録できます'
                  : 'フィルタや検索条件を変更してください'
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <CounselingCard key={r.id} record={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  tone = 'default',
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: 'default' | 'amber' | 'green';
}) {
  const activeTone =
    tone === 'amber'
      ? 'bg-amber-100 text-amber-700'
      : tone === 'green'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-vivie-100 text-vivie-700';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? activeTone : 'text-ink-500 hover:bg-ink-50'
      }`}
    >
      {label}
    </button>
  );
}

function CounselingCard({ record }: { record: RecordRow }) {
  const skin = labelsOf(SKIN_CONCERNS, record.skin_concerns);
  const face = labelsOf(FACE_CONCERNS, record.face_concerns);
  const body = labelsOf(BODY_CONCERNS, record.body_concerns);
  const goal = labelOf(GOAL_TIMELINES, record.goal_timeline);
  const budget = labelOf(MONTHLY_BUDGETS, record.monthly_budget);

  return (
    <Link
      href={`/counseling/${record.id}`}
      className="group block rounded-2xl border border-ink-100 bg-white p-5 shadow-sm hover:border-vivie-300 hover:shadow-md transition-all"
    >
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-xl font-semibold text-ink-900 group-hover:text-vivie-700 transition-colors truncate">
            {record.full_name}
          </h3>
          {record.furigana && (
            <p className="text-xs text-ink-400 truncate">{record.furigana}</p>
          )}
          <p className="text-xs text-ink-500 mt-1.5">
            {formatDate(record.submitted_at)} ・ {record.store?.name ?? '—'}
          </p>
        </div>
        {record.reviewed_at ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <CheckCircle2 size={10} />
            確認済
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            <Clock size={10} />
            未確認
          </span>
        )}
      </div>

      {/* 悩み */}
      <div className="space-y-2.5 mb-4">
        <ConcernRow label="肌" items={skin} tone="rose" />
        <ConcernRow label="顔" items={face} tone="amber" />
        <ConcernRow label="体" items={body} tone="blue" />
      </div>

      {/* 目標 + 予算 */}
      {(goal !== '—' || budget !== '—') && (
        <div className="border-t border-ink-100 pt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-ink-400">目標期限</p>
            <p className="text-ink-700 font-medium mt-0.5">{goal}</p>
          </div>
          <div>
            <p className="text-ink-400">月予算</p>
            <p className="text-ink-700 font-medium mt-0.5">{budget}</p>
          </div>
        </div>
      )}
    </Link>
  );
}

function ConcernRow({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: 'rose' | 'amber' | 'blue';
}) {
  const labelTone =
    tone === 'rose'
      ? 'bg-vivie-100 text-vivie-700'
      : tone === 'amber'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-sky-100 text-sky-700';
  const chipTone =
    tone === 'rose'
      ? 'bg-vivie-50/80 text-vivie-700 border-vivie-100'
      : tone === 'amber'
        ? 'bg-amber-50/80 text-amber-700 border-amber-100'
        : 'bg-sky-50/80 text-sky-700 border-sky-100';

  return (
    <div className="flex items-start gap-2">
      <span className={`shrink-0 inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md px-1.5 text-[10px] font-bold ${labelTone}`}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1 flex-1">
        {items.length === 0 ? (
          <span className="text-xs text-ink-300 py-0.5">—</span>
        ) : (
          items.map((c) => (
            <span
              key={c}
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs ${chipTone}`}
            >
              {c}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

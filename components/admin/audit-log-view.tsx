'use client';
import { useMemo } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { AUDIT_ACTION_LABELS } from '@/lib/audit';

interface Props {
  logs: any[];
  staff: any[];
}

function badgeTone(action: string): 'green' | 'red' | 'amber' | 'blue' {
  if (action.includes('refund') || action.includes('delete')) return 'red';
  if (action.includes('issue') || action.includes('create')) return 'green';
  if (action.includes('use')) return 'blue';
  return 'amber';
}

export function AuditLogView({ logs, staff }: Props) {
  const staffMap = useMemo(() => {
    const m = new Map<string, string>();
    (staff ?? []).forEach((s: any) => m.set(s.id, s.display_name));
    return m;
  }, [staff]);

  if (!logs || logs.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck size={28} />}
        title="操作ログがありません"
        description="返金・出納編集・会員編集・回数券の発行/使用などがここに記録されます。"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>日時</th>
            <th>操作者</th>
            <th>操作</th>
            <th>対象</th>
            <th>詳細</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l: any) => {
            const actor = l.actor_name || staffMap.get(l.actor_id) || '不明';
            const label = AUDIT_ACTION_LABELS[l.action] ?? l.action;
            return (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs text-ink-500">
                  {formatDateTime(l.created_at)}
                </td>
                <td className="whitespace-nowrap text-sm">{actor}</td>
                <td>
                  <Badge tone={badgeTone(l.action)}>{label}</Badge>
                </td>
                <td className="whitespace-nowrap text-xs text-ink-500">
                  {l.entity ?? '—'}
                  {l.entity_id ? ` #${String(l.entity_id).slice(0, 8)}` : ''}
                </td>
                <td className="max-w-xs truncate text-xs text-ink-600">
                  {l.details ? JSON.stringify(l.details) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

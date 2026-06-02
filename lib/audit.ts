import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type AnyClient = SupabaseClient<Database>;

export interface AuditEntry {
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: Record<string, any> | null;
  actorId?: string | null;
  actorName?: string | null;
}

// 監査ログ (audit_logs) を記録する。
// 返金・出納編集・会員編集など、金銭・個人情報に関わる操作の追跡用。
// 記録の失敗が本処理を止めないよう、例外は握りつぶす。
export async function logAudit(supabase: AnyClient, entry: AuditEntry): Promise<void> {
  try {
    let actorId = entry.actorId ?? null;
    if (!actorId) {
      const { data } = await supabase.auth.getUser();
      actorId = data.user?.id ?? null;
    }
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      actor_name: entry.actorName ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entityId ?? null,
      details: entry.details ?? null,
    });
  } catch {
    // no-op
  }
}

// 操作種別の表示ラベル
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'ticket.issue': '回数券 発行',
  'ticket.refund': '回数券 返金',
  'ticket.use': '回数券 使用',
  'ticket.remind': '回数券 リマインド',
  'member.create': '会員 登録',
  'member.update': '会員 編集',
  'cashbook.update': '出納 編集',
  'cashbook.delete': '出納 削除',
};

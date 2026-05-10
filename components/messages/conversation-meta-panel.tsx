'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  Pin,
  PinOff,
  CheckCheck,
  RotateCcw,
  Pencil,
  Save,
  Archive,
  ArchiveRestore,
} from 'lucide-react';

type ConvStatus = 'open' | 'handled' | 'archived';

interface Props {
  lineUserId: string;
  memberId: string | null;
  initialStatus: ConvStatus;
  initialPinned: boolean;
  initialNotes: string | null;
  initialDisplayName: string | null;
}

export function ConversationMetaPanel({
  lineUserId,
  memberId,
  initialStatus,
  initialPinned,
  initialNotes,
  initialDisplayName,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<ConvStatus>(initialStatus);
  const [pinned, setPinned] = useState(initialPinned);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(initialDisplayName ?? '');
  const [saving, setSaving] = useState(false);

  async function patch(patchBody: any) {
    const res = await fetch(
      `/api/line/conversation-meta/${encodeURIComponent(lineUserId)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patchBody),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.show(body?.error ?? '更新に失敗しました', 'error');
      return false;
    }
    return true;
  }

  async function toggleStatus(next: ConvStatus) {
    setSaving(true);
    if (await patch({ status: next })) {
      setStatus(next);
      toast.show(
        next === 'handled' ? '対応済みにしました' : next === 'archived' ? 'アーカイブしました' : '対応中に戻しました',
        'success',
      );
      router.refresh();
    }
    setSaving(false);
  }

  async function togglePin() {
    setSaving(true);
    const next = !pinned;
    if (await patch({ pinned: next })) {
      setPinned(next);
      router.refresh();
    }
    setSaving(false);
  }

  async function saveNotes() {
    setSaving(true);
    if (await patch({ internal_notes: notes })) {
      toast.show('メモを保存しました', 'success');
    }
    setSaving(false);
  }

  async function saveName() {
    if (!name.trim()) {
      toast.show('名前を入力してください', 'error');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      // line_display_name は member 側に保存
      if (memberId) {
        const { error } = await supabase
          .from('members')
          .update({ line_display_name: name.trim() })
          .eq('id', memberId);
        if (error) throw error;
      } else {
        // member 紐付けなしの場合は line_events の最新レコードに保存
        await supabase
          .from('line_events')
          .insert({
            event_type: '_manual_name_update',
            line_user_id: lineUserId,
            display_name: name.trim(),
            raw: { manual: true },
          });
      }
      toast.show('名前を更新しました', 'success');
      setEditingName(false);
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* ステータスバッジ */}
      <div className="flex items-center gap-2 flex-wrap">
        {status === 'open' ? (
          <Badge tone="amber">対応中</Badge>
        ) : status === 'handled' ? (
          <Badge tone="green">対応済</Badge>
        ) : (
          <Badge tone="default">アーカイブ済</Badge>
        )}
        {pinned && <Badge tone="rose">📌 ピン留め</Badge>}
      </div>

      {/* 対応状況ボタン */}
      <div className="grid grid-cols-2 gap-2">
        {status === 'open' ? (
          <Button onClick={() => toggleStatus('handled')} disabled={saving} size="sm">
            <CheckCheck size={14} />
            対応済みに
          </Button>
        ) : (
          <Button
            onClick={() => toggleStatus('open')}
            disabled={saving}
            size="sm"
            variant="secondary"
          >
            <RotateCcw size={14} />
            対応中に戻す
          </Button>
        )}
        <Button onClick={togglePin} disabled={saving} size="sm" variant="ghost">
          {pinned ? <PinOff size={14} /> : <Pin size={14} />}
          {pinned ? '解除' : 'ピン留め'}
        </Button>
      </div>
      <Button
        onClick={() => toggleStatus(status === 'archived' ? 'open' : 'archived')}
        disabled={saving}
        size="sm"
        variant="ghost"
        className="w-full"
      >
        {status === 'archived' ? (
          <>
            <ArchiveRestore size={14} />
            アーカイブ解除
          </>
        ) : (
          <>
            <Archive size={14} />
            アーカイブ
          </>
        )}
      </Button>

      {/* 名前編集 */}
      <div className="rounded-xl bg-ink-50/40 border border-ink-100 p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-ink-500">表示名</p>
          <button
            onClick={() => setEditingName(true)}
            className="text-[10px] text-vivie-600 hover:underline"
          >
            <Pencil size={10} className="inline mr-0.5" />
            編集
          </button>
        </div>
        {initialDisplayName ? (
          <p className="text-sm">{initialDisplayName}</p>
        ) : (
          <p className="text-xs text-ink-400">
            未取得 (お客様が友だち追加していない可能性)
          </p>
        )}
      </div>

      {/* 内部メモ */}
      <div>
        <p className="text-xs font-medium text-ink-500 mb-1.5">スタッフ用メモ</p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="このお客様に関する社内メモ"
          rows={3}
          className="text-xs"
        />
        <div className="flex justify-end mt-1.5">
          <Button onClick={saveNotes} size="sm" variant="secondary" disabled={saving}>
            <Save size={12} />
            保存
          </Button>
        </div>
      </div>

      <Modal
        open={editingName}
        onClose={() => setEditingName(false)}
        title="表示名を編集"
        description={memberId ? '会員情報の line_display_name を更新します' : 'お客様情報を編集します'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingName(false)}>
              キャンセル
            </Button>
            <Button onClick={saveName} disabled={saving}>
              <Save size={14} />
              保存
            </Button>
          </>
        }
      >
        <Field label="表示名" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 山田 花子"
            autoFocus
          />
        </Field>
      </Modal>
    </div>
  );
}

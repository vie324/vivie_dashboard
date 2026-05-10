'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { UserPlus, Link2, Search, Loader2 } from 'lucide-react';

interface MemberLite {
  id: string;
  full_name: string;
  furigana: string | null;
  phone: string | null;
  line_user_id: string | null;
  line_picture_url: string | null;
}

interface Props {
  lineUserId: string;
  initialDisplayName: string | null;
}

// 「(名前未取得)」のときに 1 クリックで会員作成 / 既存会員紐付けができるパネル
export function QuickLinkMember({ lineUserId, initialDisplayName }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [openMode, setOpenMode] = useState<'new' | 'link' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 新規作成
  const [newForm, setNewForm] = useState({
    full_name: initialDisplayName ?? '',
    furigana: '',
    phone: '',
    email: '',
  });

  // 既存検索
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [query, setQuery] = useState(initialDisplayName ?? '');

  useEffect(() => {
    if (openMode !== 'link') return;
    const supabase = createClient();
    supabase
      .from('members')
      .select('id, full_name, furigana, phone, line_user_id, line_picture_url')
      .order('full_name')
      .limit(2000)
      .then(({ data }) => setMembers((data as MemberLite[]) ?? []));
  }, [openMode]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members.slice(0, 30);
    return members
      .filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          (m.furigana ?? '').toLowerCase().includes(q) ||
          (m.phone ?? '').includes(q),
      )
      .slice(0, 30);
  }, [members, query]);

  async function createNew() {
    if (!newForm.full_name.trim()) {
      toast.show('氏名を入力してください', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/line/link-new-member', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          line_user_id: lineUserId,
          full_name: newForm.full_name,
          furigana: newForm.furigana || null,
          phone: newForm.phone || null,
          email: newForm.email || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? '作成に失敗しました');
      toast.show('新規会員として登録 + 紐付けしました', 'success');
      setOpenMode(null);
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function linkExisting(memberId: string) {
    setSubmitting(true);
    try {
      const supabase = createClient();
      // line_events から最新プロフィール
      const { data: latest } = await supabase
        .from('line_events')
        .select('display_name, picture_url')
        .eq('line_user_id', lineUserId)
        .not('display_name', 'is', null)
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase
        .from('members')
        .update({
          line_user_id: lineUserId,
          line_display_name: (latest as any)?.display_name ?? null,
          line_picture_url: (latest as any)?.picture_url ?? null,
        })
        .eq('id', memberId);
      if (error) throw error;

      // 過去の line_events / line_messages にも紐付け
      await supabase
        .from('line_events')
        .update({ member_id: memberId })
        .eq('line_user_id', lineUserId)
        .is('member_id', null);
      await supabase
        .from('line_messages')
        .update({ member_id: memberId })
        .eq('line_user_id', lineUserId)
        .is('member_id', null);

      toast.show('既存会員と紐付けしました', 'success');
      setOpenMode(null);
      router.refresh();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '失敗しました', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 space-y-2">
        <p className="font-medium">会員と紐付いていません</p>
        <p>1 クリックで紐付けできます:</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="primary" onClick={() => setOpenMode('new')}>
            <UserPlus size={12} />
            新規会員
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setOpenMode('link')}>
            <Link2 size={12} />
            既存と紐付け
          </Button>
        </div>
        <p className="font-mono text-[9px] truncate text-amber-600">{lineUserId}</p>
      </div>

      {/* 新規作成モーダル */}
      <Modal
        open={openMode === 'new'}
        onClose={() => setOpenMode(null)}
        title="LINE から新規会員作成"
        description="この LINE お客様を新規会員として登録 + 自動で紐付けします"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenMode(null)}>
              キャンセル
            </Button>
            <Button onClick={createNew} disabled={submitting}>
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <UserPlus size={14} />
              作成 + 紐付け
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="氏名" required>
            <Input
              value={newForm.full_name}
              onChange={(e) => setNewForm((f) => ({ ...f, full_name: e.target.value }))}
              autoFocus
            />
          </Field>
          <Field label="フリガナ">
            <Input
              value={newForm.furigana}
              onChange={(e) => setNewForm((f) => ({ ...f, furigana: e.target.value }))}
            />
          </Field>
          <Field label="電話番号">
            <Input
              type="tel"
              value={newForm.phone}
              onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Field>
          <Field label="メール">
            <Input
              type="email"
              value={newForm.email}
              onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>

      {/* 既存と紐付けモーダル */}
      <Modal
        open={openMode === 'link'}
        onClose={() => setOpenMode(null)}
        title="既存会員と紐付け"
        description="氏名・電話番号で検索して選択してください"
        size="lg"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="氏名 / フリガナ / 電話番号"
              className="pl-9"
            />
          </div>
          <div className="max-h-80 overflow-y-auto rounded-xl border border-ink-100 divide-y divide-ink-100">
            {filteredMembers.length === 0 ? (
              <p className="p-3 text-sm text-ink-400 text-center">該当する会員がいません</p>
            ) : (
              filteredMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => linkExisting(m.id)}
                  disabled={submitting || !!m.line_user_id}
                  className="block w-full px-3 py-2 text-left hover:bg-vivie-50/40 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.full_name} src={m.line_picture_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{m.full_name}</p>
                      <p className="text-xs text-ink-400">
                        {m.furigana ?? ''} {m.phone ?? ''}
                      </p>
                    </div>
                    {m.line_user_id && (
                      <span className="text-[10px] text-ink-400">他の LINE と紐付済</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

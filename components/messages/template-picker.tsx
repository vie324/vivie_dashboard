'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { FileText, Save, Trash2, Plus } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  body: string;
  category: string | null;
}

interface Props {
  memberName: string;
  onPick: (text: string) => void;
}

export function TemplatePicker({ memberName, onPick }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [draft, setDraft] = useState({ name: '', body: '' });

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from('line_templates')
      .select('*')
      .order('name')
      .then(({ data }) => setTemplates((data as Template[]) ?? []));
  }, [open]);

  function pick(t: Template) {
    // {name} を会員名に置換
    const text = t.body.replaceAll('{name}', memberName);
    onPick(text);
    setOpen(false);
  }

  async function saveTemplate() {
    if (!draft.name.trim() || !draft.body.trim()) {
      toast.show('名前と本文を入力してください', 'error');
      return;
    }
    const supabase = createClient();
    if (editing) {
      const { error } = await supabase
        .from('line_templates')
        .update({ name: draft.name, body: draft.body })
        .eq('id', editing.id);
      if (error) {
        toast.show(error.message, 'error');
        return;
      }
      setTemplates((t) =>
        t.map((x) => (x.id === editing.id ? { ...x, ...draft } : x)),
      );
    } else {
      const { data, error } = await supabase
        .from('line_templates')
        .insert({ name: draft.name, body: draft.body })
        .select()
        .single();
      if (error) {
        toast.show(error.message, 'error');
        return;
      }
      setTemplates((t) => [...t, data as Template]);
    }
    setEditing(null);
    setDraft({ name: '', body: '' });
    toast.show('保存しました', 'success');
  }

  async function removeTemplate(id: string) {
    if (!confirm('テンプレートを削除しますか?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('line_templates').delete().eq('id', id);
    if (error) {
      toast.show(error.message, 'error');
      return;
    }
    setTemplates((t) => t.filter((x) => x.id !== id));
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} type="button">
        <FileText size={14} />
        テンプレ
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
          setDraft({ name: '', body: '' });
        }}
        title="メッセージテンプレート"
        description="クリックで本文に挿入。{name} は会員名に置換されます"
        size="lg"
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-ink-100 hover:border-vivie-200 transition-colors"
            >
              <button
                type="button"
                onClick={() => pick(t)}
                className="block w-full text-left p-3 hover:bg-vivie-50/30"
              >
                <p className="text-sm font-medium">{t.name}</p>
                <p className="mt-1 text-xs text-ink-500 whitespace-pre-wrap line-clamp-3">
                  {t.body.replaceAll('{name}', memberName)}
                </p>
              </button>
              <div className="border-t border-ink-100 px-3 py-1.5 flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(t);
                    setDraft({ name: t.name, body: t.body });
                  }}
                  className="text-[10px] text-ink-500 hover:text-vivie-600"
                >
                  編集
                </button>
                <span className="text-ink-200">|</span>
                <button
                  type="button"
                  onClick={() => removeTemplate(t.id)}
                  className="text-[10px] text-ink-500 hover:text-red-600"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 編集 / 新規追加フォーム */}
        <div className="mt-4 border-t border-ink-100 pt-4 space-y-3">
          <p className="text-xs font-medium text-ink-700">
            {editing ? `「${editing.name}」を編集` : '新規テンプレート'}
          </p>
          <Field label="名前">
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="例: 予約確認"
            />
          </Field>
          <Field label="本文" hint="{name} と書くと送信時に会員名に置き換わります">
            <Textarea
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder="{name}様、..."
              rows={4}
            />
          </Field>
          <div className="flex justify-end gap-2">
            {editing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDraft({ name: '', body: '' });
                }}
              >
                クリア
              </Button>
            )}
            <Button type="button" size="sm" onClick={saveTemplate}>
              {editing ? <Save size={14} /> : <Plus size={14} />}
              {editing ? '更新' : '追加'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

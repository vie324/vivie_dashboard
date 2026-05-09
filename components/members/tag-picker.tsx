'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { Plus, X, Tag as TagIcon } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
  color: string;
}

const colorClass: Record<string, string> = {
  rose: 'bg-vivie-100 text-vivie-700 border-vivie-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  blue: 'bg-sky-100 text-sky-700 border-sky-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  red: 'bg-red-100 text-red-700 border-red-200',
};

export function TagPicker({ memberId, initialTagIds }: { memberId: string; initialTagIds: string[] }) {
  const toast = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialTagIds));
  const [adding, setAdding] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('tags')
      .select('id, name, color')
      .order('name')
      .then(({ data }) => setTags((data as Tag[]) ?? []));
  }, []);

  async function toggle(tagId: string) {
    const supabase = createClient();
    if (selected.has(tagId)) {
      const { error } = await supabase
        .from('member_tags')
        .delete()
        .eq('member_id', memberId)
        .eq('tag_id', tagId);
      if (error) {
        toast.show(error.message, 'error');
        return;
      }
      const next = new Set(selected);
      next.delete(tagId);
      setSelected(next);
    } else {
      const { error } = await supabase
        .from('member_tags')
        .insert({ member_id: memberId, tag_id: tagId });
      if (error) {
        toast.show(error.message, 'error');
        return;
      }
      const next = new Set(selected);
      next.add(tagId);
      setSelected(next);
    }
  }

  async function createTag() {
    if (!newTagName.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('tags')
      .insert({ name: newTagName.trim(), color: 'rose' })
      .select()
      .single();
    if (error) {
      toast.show(error.message, 'error');
      return;
    }
    setTags((t) => [...t, data as Tag]);
    setNewTagName('');
    if (data) await toggle((data as Tag).id);
    setAdding(false);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => {
          const active = selected.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                active
                  ? colorClass[t.color] ?? colorClass.rose
                  : 'bg-white border-ink-200 text-ink-400 hover:bg-ink-50'
              }`}
            >
              <TagIcon size={10} />
              {t.name}
            </button>
          );
        })}
        {adding ? (
          <span className="inline-flex items-center gap-1">
            <input
              autoFocus
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createTag();
                if (e.key === 'Escape') setAdding(false);
              }}
              placeholder="タグ名"
              className="h-7 rounded-full border border-ink-200 bg-white px-2.5 text-xs"
            />
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-full p-1 text-ink-400 hover:bg-ink-100"
            >
              <X size={12} />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink-300 px-2.5 py-1 text-xs text-ink-500 hover:bg-ink-50"
          >
            <Plus size={10} />
            タグ追加
          </button>
        )}
      </div>
    </div>
  );
}

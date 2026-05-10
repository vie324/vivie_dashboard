import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { parseTsv, transformRow } from '@/lib/counseling-import';

export async function POST(request: NextRequest) {
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // admin / manager のみ
  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from('staff')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = (actor as any)?.role;
  if (role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ error: '権限がありません (admin/manager のみ)' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const { tsv, store_id, dry_run } = body;
  if (!tsv || typeof tsv !== 'string') {
    return NextResponse.json({ error: 'tsv が空です' }, { status: 400 });
  }

  const raw = parseTsv(tsv);
  const transformed = raw.map(transformRow).filter(Boolean) as Awaited<
    ReturnType<typeof transformRow>
  >[];

  // スタッフ名を staff_id に解決
  const { data: staffList } = await supabase.from('staff').select('id, display_name');
  const staffMap = new Map<string, string>();
  (staffList ?? []).forEach((s: any) => {
    const norm = (s.display_name ?? '').replace(/\s+/g, '');
    staffMap.set(norm, s.id);
  });

  const records = transformed.map((t: any) => {
    const norm = (t.assigned_staff_name ?? '').replace(/\s+/g, '');
    const staffId = staffMap.get(norm) ?? null;
    return {
      ...t,
      assigned_staff_id: staffId,
      store_id: store_id ?? null,
    };
  });

  // 重複チェック (氏名 + submitted_at で既存と一致するものは除外)
  const existing = await supabase
    .from('counseling_records')
    .select('full_name, submitted_at')
    .eq('imported', true);
  const existingKeys = new Set(
    (existing.data ?? []).map((r: any) => `${r.full_name}|${r.submitted_at}`),
  );
  const newRecords = records.filter(
    (r) => !existingKeys.has(`${r.full_name}|${r.submitted_at}`),
  );
  const duplicateCount = records.length - newRecords.length;

  if (dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      total_parsed: raw.length,
      transformed: records.length,
      new_records: newRecords.length,
      duplicates: duplicateCount,
      preview: newRecords.slice(0, 5),
      unmatched_staff: Array.from(
        new Set(
          records
            .filter((r) => !r.assigned_staff_id && r.assigned_staff_name)
            .map((r) => r.assigned_staff_name),
        ),
      ),
    });
  }

  // バッチ挿入 (100 件ずつ)
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < newRecords.length; i += 100) {
    const chunk = newRecords.slice(i, i + 100);
    const { error, count } = await supabase
      .from('counseling_records')
      .insert(chunk, { count: 'exact' });
    if (error) {
      errors.push(`row ${i}: ${error.message}`);
    } else {
      inserted += count ?? chunk.length;
    }
  }

  return NextResponse.json({
    ok: true,
    total_parsed: raw.length,
    inserted,
    duplicates: duplicateCount,
    errors,
  });
}

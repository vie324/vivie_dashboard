import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { geocode } from '@/lib/geocoding';

// 未解決のカウンセリング住所を一括ジオコーディング
// admin/manager のみ。Nominatim のレート制限 (1 req/sec) に従ってループ。
export async function POST(request: NextRequest) {
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: actor } = await supabase
    .from('staff')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = (actor as any)?.role;
  if (role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 20, 50);
  const retryFailed = body.retry_failed ?? true;

  // 未試行を優先、次に失敗済 (retry_failed=true の場合)
  const query = supabase
    .from('counseling_records')
    .select('id, address')
    .not('address', 'is', null)
    .is('geo_lat', null);
  // retry_failed=false の場合は未試行のみ
  if (!retryFailed) query.is('geo_attempted_at', null);
  const { data: targets } = await query
    .order('geo_attempted_at', { ascending: true, nullsFirst: true })
    .order('submitted_at', { ascending: false })
    .limit(limit);

  if (!targets || targets.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: '未解決の住所はありません' });
  }

  let resolved = 0;
  let failed = 0;
  for (const t of targets as any[]) {
    try {
      const result = await geocode(t.address);
      if (result) {
        await supabase
          .from('counseling_records')
          .update({
            geo_lat: result.lat,
            geo_lng: result.lng,
            geo_source: result.source,
            geo_attempted_at: new Date().toISOString(),
            geo_error: null,
          })
          .eq('id', t.id);
        resolved++;
      } else {
        await supabase
          .from('counseling_records')
          .update({
            geo_attempted_at: new Date().toISOString(),
            geo_error: 'not_found',
          })
          .eq('id', t.id);
        failed++;
      }
    } catch (err) {
      failed++;
      await supabase
        .from('counseling_records')
        .update({
          geo_attempted_at: new Date().toISOString(),
          geo_error: err instanceof Error ? err.message : 'error',
        })
        .eq('id', t.id);
    }
    // Nominatim 利用規約: 1 req/sec
    await new Promise((r) => setTimeout(r, 1100));
  }

  return NextResponse.json({
    ok: true,
    processed: targets.length,
    resolved,
    failed,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { geocode } from '@/lib/geocoding';

// 単一住所を解決して counseling_records に保存
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const { id, address } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  let resolveAddress = address;
  if (!resolveAddress) {
    const { data } = await supabase
      .from('counseling_records')
      .select('address')
      .eq('id', id)
      .maybeSingle();
    resolveAddress = (data as any)?.address;
  }

  if (!resolveAddress) {
    return NextResponse.json({ error: '住所が登録されていません' }, { status: 400 });
  }

  const result = await geocode(resolveAddress);
  if (!result) {
    await supabase
      .from('counseling_records')
      .update({
        geo_attempted_at: new Date().toISOString(),
        geo_error: 'not_found',
      })
      .eq('id', id);
    return NextResponse.json({ error: '住所を解決できませんでした' }, { status: 404 });
  }

  const { error } = await supabase
    .from('counseling_records')
    .update({
      geo_lat: result.lat,
      geo_lng: result.lng,
      geo_source: result.source,
      geo_attempted_at: new Date().toISOString(),
      geo_error: null,
    })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...result });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { pushMessage, lineConfigured } from '@/lib/line/client';
import { buildFollowupFlex } from '@/lib/line/flex-message';

// 施術レポートからフォローアップ Flex Message を送る
export async function POST(
  _request: NextRequest,
  { params }: { params: { reportId: string } },
) {
  // 認証ユーザーのみ
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!lineConfigured()) {
    return NextResponse.json(
      {
        error:
          'LINE 連携が未設定です。Vercel に LINE_CHANNEL_ACCESS_TOKEN と LINE_CHANNEL_SECRET を設定してください。',
      },
      { status: 500 },
    );
  }

  const supabase = createServiceClient();
  const { data: report } = await supabase
    .from('treatment_reports')
    .select('*, member:members(full_name, line_user_id), store:stores(name)')
    .eq('id', params.reportId)
    .maybeSingle();

  if (!report) return NextResponse.json({ error: 'report not found' }, { status: 404 });
  const r = report as any;

  if (!r.member?.line_user_id) {
    return NextResponse.json(
      { error: 'この会員には LINE userId が紐付いていません。会員詳細から LINE 連携してください。' },
      { status: 400 },
    );
  }

  if (!r.followup_offer) {
    return NextResponse.json(
      { error: 'フォローアップオファーが未設定です。施術レポートを編集して設定してください。' },
      { status: 400 },
    );
  }

  const flex = buildFollowupFlex({
    customerName: r.member.full_name,
    storeName: r.store?.name ?? 'vivie',
    treatmentDate: r.treatment_date,
    skinScores: r.skin_scores ?? {},
    faceScores: r.face_scores ?? {},
    observations: r.observations,
    offer: r.followup_offer,
  });

  const result = await pushMessage(r.member.line_user_id, [flex]);
  if (!result.ok) {
    await supabase
      .from('treatment_reports')
      .update({
        line_send_status: 'error',
        line_send_error: result.error,
      })
      .eq('id', r.id);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  await supabase
    .from('treatment_reports')
    .update({
      line_sent_at: new Date().toISOString(),
      line_request_id: result.requestId,
      line_send_status: 'sent',
      line_send_error: null,
    })
    .eq('id', r.id);

  return NextResponse.json({ ok: true, request_id: result.requestId });
}

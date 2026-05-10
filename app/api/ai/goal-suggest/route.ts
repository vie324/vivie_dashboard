import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { complete, claudeConfigured } from '@/lib/ai/claude';

// 過去の日報データから次月の目標を提案
// POST /api/ai/goal-suggest
// body: { store_id?: string, target_month?: 'YYYY-MM' (省略時は来月) }
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!claudeConfigured()) {
    return NextResponse.json(
      {
        error: 'ANTHROPIC_API_KEY が未設定です。Vercel の環境変数に追加してください。',
      },
      { status: 500 },
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    /* empty body 許容 */
  }

  const targetMonth =
    body.target_month ??
    (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().slice(0, 7);
    })();

  // 過去 6 か月の日報を取得
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const fromDate = sixMonthsAgo.toISOString().slice(0, 10);

  const reportQuery = supabase
    .from('daily_reports')
    .select(
      'report_date, hpb_new_count, hpb_contract_count, meta_new_count, meta_contract_count, minimo_new_count, minimo_contract_count, referral_new_count, referral_contract_count, existing_treatment_count, repeat_count, total_sales, discount_total, store:stores(name)',
    )
    .gte('report_date', fromDate)
    .order('report_date');

  if (body.store_id) reportQuery.eq('store_id', body.store_id);

  const { data: reports, error } = await reportQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!reports || reports.length === 0) {
    return NextResponse.json(
      { error: '日報データが過去 6 か月にありません。最低 1 か月分の日報を入力してから再度お試しください。' },
      { status: 400 },
    );
  }

  // 月別集計
  const byMonth = new Map<string, any>();
  for (const r of reports as any[]) {
    const m = r.report_date.slice(0, 7);
    const cur =
      byMonth.get(m) ?? {
        month: m,
        days: 0,
        hpb_new: 0,
        hpb_contract: 0,
        meta_new: 0,
        meta_contract: 0,
        minimo_new: 0,
        minimo_contract: 0,
        referral_new: 0,
        referral_contract: 0,
        existing: 0,
        repeat: 0,
        sales: 0,
        discount: 0,
      };
    cur.days++;
    cur.hpb_new += r.hpb_new_count;
    cur.hpb_contract += r.hpb_contract_count;
    cur.meta_new += r.meta_new_count;
    cur.meta_contract += r.meta_contract_count;
    cur.minimo_new += r.minimo_new_count ?? 0;
    cur.minimo_contract += r.minimo_contract_count ?? 0;
    cur.referral_new += r.referral_new_count;
    cur.referral_contract += r.referral_contract_count;
    cur.existing += r.existing_treatment_count;
    cur.repeat += r.repeat_count;
    cur.sales += r.total_sales;
    cur.discount += r.discount_total;
    byMonth.set(m, cur);
  }
  const monthlyData = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));

  // Claude にプロンプト送信
  const prompt = `あなたは美容サロンの経営アドバイザーです。
過去 6 か月の日報から、次月 ${targetMonth} の目標数値を提案してください。

過去の月次集計 (JSON):
${JSON.stringify(monthlyData, null, 2)}

データの解釈:
- hpb / meta / minimo / referral: 媒体別の新規来店数 (new) と契約成立数 (contract)
- existing: 既存顧客の施術件数
- repeat: 既存顧客のうちリピート (再来) 件数
- sales: 総売上, discount: 割引額

以下の JSON 形式で出力してください (説明文や注釈は出力せず JSON のみ):

{
  "summary": "過去 6 か月の傾向を 2-3 行で要約",
  "kpis": {
    "hpb_new_target": 数値,
    "meta_new_target": 数値,
    "minimo_new_target": 数値,
    "referral_new_target": 数値,
    "contract_target": 数値,
    "sales_target": 数値,
    "repeat_rate_target": 数値 (0-100 のパーセント)
  },
  "rationale": [
    "目標値の根拠を箇条書きで 3-5 個",
    "..."
  ],
  "actions": [
    "達成のためにすべきアクションを箇条書きで 3-5 個",
    "..."
  ]
}`;

  try {
    const result = await complete({
      system:
        'あなたは美容サロンの経営アドバイザーです。日本語で実用的な目標提案を JSON で返します。装飾やコードフェンスは不要です。',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
    });

    // JSON 部分を抽出
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'AI からの応答が JSON 形式ではありませんでした', raw: result.text },
        { status: 500 },
      );
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      ok: true,
      target_month: targetMonth,
      monthly_data: monthlyData,
      suggestion: parsed,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI 呼び出しに失敗しました' },
      { status: 500 },
    );
  }
}

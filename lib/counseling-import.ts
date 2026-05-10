// 過去カウンセリングデータ (スプレッドシート) の TSV/CSV 取り込み用パーサ + マッパ
//
// 元データの列: A〜X
//  A: タイムスタンプ
//  B: 氏名
//  C: フリガナ
//  D: 担当者
//  E: 来店経由
//  F: クロージング or 次回予約
//  G: 次回予約日
//  H: 未契約理由
//  I: 契約理由
//  J: 契約コース
//  K: 住所
//  L: 電話番号
//  M: 生年月日
//  N: 職業
//  O: 来店理由 (複数)
//  P: 他サロンから理由
//  Q: 不満点 (複数)
//  R: 肌悩み (複数)
//  S: 顔悩み (複数)
//  T: 体悩み (複数)
//  U: 過去施術 (複数)
//  V: 目標期限
//  W: 同意
//  X: 月の美容代

export interface RawRow {
  raw_line: string;
  timestamp: string;
  full_name: string;
  furigana: string;
  assignee_name: string;
  acquisition_channel: string;
  closing_status_raw: string;
  next_reservation_date: string;
  no_contract_reason: string;
  contract_reason: string;
  contract_plan: string;
  address: string;
  phone: string;
  birth_date: string;
  occupation: string;
  visit_reasons_text: string;
  switch_reason_text: string;
  past_complaints_text: string;
  skin_concerns_text: string;
  face_concerns_text: string;
  body_concerns_text: string;
  past_treatments_text: string;
  goal_timeline_text: string;
  agreement_text: string;
  monthly_budget_text: string;
}

export function parseTsv(input: string): RawRow[] {
  // ヘッダー行は自動判定 (1 行目に「タイムスタンプ」を含むか)
  const lines = input.split(/\r?\n/);
  const rows: RawRow[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.includes('タイムスタンプ') && line.includes('お名前')) continue; // ヘッダ
    const cols = line.split('\t');
    if (cols.length < 5) continue;
    rows.push({
      raw_line: line,
      timestamp: cols[0]?.trim() ?? '',
      full_name: cols[1]?.trim() ?? '',
      furigana: cols[2]?.trim() ?? '',
      assignee_name: cols[3]?.trim() ?? '',
      acquisition_channel: cols[4]?.trim() ?? '',
      closing_status_raw: cols[5]?.trim() ?? '',
      next_reservation_date: cols[6]?.trim() ?? '',
      no_contract_reason: cols[7]?.trim() ?? '',
      contract_reason: cols[8]?.trim() ?? '',
      contract_plan: cols[9]?.trim() ?? '',
      address: cols[10]?.trim() ?? '',
      phone: cols[11]?.trim() ?? '',
      birth_date: cols[12]?.trim() ?? '',
      occupation: cols[13]?.trim() ?? '',
      visit_reasons_text: cols[14]?.trim() ?? '',
      switch_reason_text: cols[15]?.trim() ?? '',
      past_complaints_text: cols[16]?.trim() ?? '',
      skin_concerns_text: cols[17]?.trim() ?? '',
      face_concerns_text: cols[18]?.trim() ?? '',
      body_concerns_text: cols[19]?.trim() ?? '',
      past_treatments_text: cols[20]?.trim() ?? '',
      goal_timeline_text: cols[21]?.trim() ?? '',
      agreement_text: cols[22]?.trim() ?? '',
      monthly_budget_text: cols[23]?.trim() ?? '',
    });
  }
  return rows;
}

// ----- 値マッピング (counseling-options.ts と同期) -----

const VISIT_REASON_MAP: Record<string, string> = {
  '価格が希望にあっていた': 'price',
  '立地が魅力的だった': 'location',
  'SNSが魅力的だった': 'sns',
  'ホットペッパーの内容が魅力的だった': 'hpb',
  '受けてみたいメニューがあった': 'menu',
  '口コミが良かった': 'reviews',
};

const PAST_TREATMENT_MAP: Record<string, string> = {
  小顔矯正: 'small_face',
  ドライヘッドスパ: 'dry_head_spa',
  ハイドラ: 'hydra',
  プラズマ: 'plasma',
  EMS: 'ems',
  ラジオ波: 'rf',
  ハーブピーリング: 'herb_peel',
  レモンボトル: 'lemon_bottle',
  フェイシャルワックス: 'face_wax',
  なし: 'none',
};

const SWITCH_REASON_MAP: Record<string, string> = {
  当サロンに行ってみたかった: 'try_here',
  いつもサロンを転々としている: 'often_change',
  '同じサロンに通っているが、行きたい時間に予約が取れなかった': 'availability',
  '満足しなかった・不満があった': 'dissatisfaction',
};

const PAST_COMPLAINTS_MAP: Record<string, string> = {
  '【サロン】衛生的でなかった': 'hygiene',
  '【サロン】サロン内の音楽/会話がうるさかった': 'noise',
  '【施術】時間が長かった': 'duration',
  '【接客】会話が不快だった': 'conversation',
  '【接客】無愛想だった': 'unfriendly',
  '【接客】態度が悪かった': 'attitude',
  '【接客】営業が強すぎた': 'sales',
  '【施術】効果を実感できなかった': 'no_effect',
  '【施術】効果が続かなかった': 'no_lasting',
};

const SKIN_CONCERN_MAP: Record<string, string> = {
  毛穴: 'pores',
  ニキビ: 'acne',
  シミ: 'spots',
  肌荒れ: 'irritation',
  乾燥: 'dryness',
};

const FACE_CONCERN_MAP: Record<string, string> = {
  たるみ: 'sagging',
  ほうれい線: 'nasolabial',
  二重アゴ: 'double_chin',
  食いしばり: 'jaw_tension',
  左右差: 'asymmetry',
  ゆがみ: 'misalignment',
  むくみ: 'puffiness',
};

const BODY_CONCERN_MAP: Record<string, string> = {
  '頭・ハチの張り': 'head',
  眼精疲労: 'eye',
  '首・ストレートネック': 'neck',
  肩こり: 'shoulder',
};

const GOAL_TIMELINE_MAP: Record<string, string> = {
  イベントまでに解消したい: 'event',
  '3ヶ月以内': '3m',
  半年以内: '6m',
  '1年以内': '1y',
};

const MONTHLY_BUDGET_MAP: Record<string, string> = {
  ほとんど使っていない: 'minimal',
  '10,000円以内': '10k',
  '20,000円〜30,000円': '20-30k',
  '30,000円〜50,000円': '30-50k',
  '50,000円以上': '50k+',
};

function splitMulti(value: string): string[] {
  if (!value) return [];
  return value
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapMulti(value: string, map: Record<string, string>): { mapped: string[]; other: string[] } {
  const mapped: string[] = [];
  const other: string[] = [];
  for (const v of splitMulti(value)) {
    const m = map[v];
    if (m) mapped.push(m);
    else other.push(v);
  }
  return { mapped, other };
}

function parseTimestamp(s: string): string | null {
  // "2025/09/15 12:38:39" → ISO
  if (!s) return null;
  const m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(se ?? 0),
  );
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseDate(s: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const yy = String(y).padStart(4, '0');
  const mm = String(mo).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function classifyClosing(raw: string): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  if (/^クロージング/i.test(t)) return 'closing';
  if (/^次回予約/i.test(t)) return 'next_reservation';
  if (/^なし$|^特になし$|^特に$/.test(t)) return 'none';
  return 'other';
}

export interface TransformedRow {
  full_name: string;
  furigana: string | null;
  phone: string;
  birth_date: string | null;
  occupation: string | null;
  address: string | null;
  submitted_at: string;
  // 来店経由・担当
  acquisition_channel: string | null;
  assigned_staff_name: string | null;
  // クロージング
  closing_status: string | null;
  closing_status_raw: string | null;
  next_reservation_date: string | null;
  no_contract_reason: string | null;
  contract_reason: string | null;
  contract_plan: string | null;
  // 来店動機 / 経験 / 不満
  visit_reasons: string[];
  visit_reason_other: string | null;
  switch_reason: string | null;
  switch_reason_other: string | null;
  past_complaints: string[];
  past_complaints_other: string | null;
  past_treatments: string[];
  // 悩み
  skin_concerns: string[];
  face_concerns: string[];
  body_concerns: string[];
  // 目標
  goal_timeline: string | null;
  monthly_budget: string | null;
  agreed_to_terms: boolean;
  imported: true;
}

export function transformRow(r: RawRow): TransformedRow | null {
  if (!r.full_name) return null;
  const submittedAt = parseTimestamp(r.timestamp) ?? new Date().toISOString();

  const visit = mapMulti(r.visit_reasons_text, VISIT_REASON_MAP);
  const treatments = mapMulti(r.past_treatments_text, PAST_TREATMENT_MAP);
  const complaints = mapMulti(r.past_complaints_text, PAST_COMPLAINTS_MAP);
  const skin = mapMulti(r.skin_concerns_text, SKIN_CONCERN_MAP);
  const face = mapMulti(r.face_concerns_text, FACE_CONCERN_MAP);
  const body = mapMulti(r.body_concerns_text, BODY_CONCERN_MAP);

  // switch_reason は単一だが SWITCH_REASON_MAP は完全一致でないかもしれない
  const switchReasonRaw = (r.switch_reason_text ?? '').trim();
  let switchReason: string | null = null;
  let switchReasonOther: string | null = null;
  if (switchReasonRaw) {
    switchReason = SWITCH_REASON_MAP[switchReasonRaw] ?? 'other';
    if (switchReason === 'other') switchReasonOther = switchReasonRaw;
  }

  return {
    full_name: r.full_name,
    furigana: r.furigana || null,
    phone: r.phone || '',
    birth_date: parseDate(r.birth_date),
    occupation: r.occupation || null,
    address: r.address || null,
    submitted_at: submittedAt,
    acquisition_channel: r.acquisition_channel || null,
    assigned_staff_name: r.assignee_name || null,
    closing_status: classifyClosing(r.closing_status_raw),
    closing_status_raw: r.closing_status_raw || null,
    next_reservation_date: parseDate(r.next_reservation_date),
    no_contract_reason: r.no_contract_reason || null,
    contract_reason: r.contract_reason || null,
    contract_plan: r.contract_plan || null,
    visit_reasons: visit.mapped,
    visit_reason_other: visit.other.length > 0 ? visit.other.join(', ') : null,
    switch_reason: switchReason,
    switch_reason_other: switchReasonOther,
    past_complaints: complaints.mapped,
    past_complaints_other: complaints.other.length > 0 ? complaints.other.join(', ') : null,
    past_treatments: treatments.mapped,
    skin_concerns: skin.mapped,
    face_concerns: face.mapped,
    body_concerns: body.mapped,
    goal_timeline: GOAL_TIMELINE_MAP[r.goal_timeline_text] ?? null,
    monthly_budget: MONTHLY_BUDGET_MAP[r.monthly_budget_text] ?? null,
    agreed_to_terms: !!r.agreement_text,
    imported: true,
  };
}

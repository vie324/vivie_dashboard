// 予約 CSV / TSV インポート用パーサ
// HPB (サロンボード) / minimo / 自由 CSV に対応

export type ReservationSource = 'hpb' | 'minimo' | 'phone' | 'direct' | 'line' | 'instagram' | 'threads' | 'other';
export type ReservationStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface ParsedReservation {
  customer_name: string;
  customer_furigana?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  source: ReservationSource;
  external_id?: string | null;
  reservation_at: string; // ISO
  duration_minutes: number;
  menu?: string | null;
  amount?: number | null;
  staff_name?: string | null;
  status: ReservationStatus;
  notes?: string | null;
  source_data?: Record<string, unknown>;
}

// CSV の 1 行を ',' or '\t' で分割。引用符 "" にも対応
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',' || ch === '\t') {
        result.push(current);
        current = '';
      } else current += ch;
    }
  }
  result.push(current);
  return result.map((c) => c.trim());
}

export function parseRows(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

// 日時パース
function parseDateTime(s: string): string | null {
  if (!s) return null;
  // 2026/05/10 14:30 / 2026-05-10 14:30 / 2026/05/10 14:30:00
  const m = s.match(
    /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/,
  );
  if (m) {
    const [, y, mo, d, h, mi, se] = m;
    const date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(se ?? 0),
    );
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  // ISO 形式
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) return iso.toISOString();
  return null;
}

function parseDuration(s: string | undefined | null): number {
  if (!s) return 60;
  const num = parseInt(String(s).replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(num) || num <= 0) return 60;
  return num;
}

function parseAmount(s: string | undefined | null): number | null {
  if (!s) return null;
  const num = parseInt(String(s).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(num) ? num : null;
}

// 媒体別プリセット (列名 → フィールド名)
// HPB (サロンボード) のエクスポート例: 来店日,来店時間,所要時間,お客様名,フリガナ,電話番号,メニュー,スタッフ,予約番号,ステータス
// minimo のエクスポート例: 予約日時,お客様名,フリガナ,電話番号,メニュー,担当,予約ID
export const PRESETS: Record<
  string,
  { source: ReservationSource; mapping: Record<string, string[]> }
> = {
  hpb: {
    source: 'hpb',
    mapping: {
      reservation_at: ['予約日時', '来店日時'],
      reservation_date: ['来店日', '予約日'],
      reservation_time: ['来店時間', '予約時間'],
      duration: ['所要時間', '施術時間'],
      customer_name: ['お客様名', '氏名', '会員名'],
      customer_furigana: ['フリガナ', 'カナ'],
      customer_phone: ['電話番号', '電話', '携帯'],
      customer_email: ['メールアドレス', 'メール'],
      menu: ['メニュー', 'ご来店メニュー', 'コース'],
      amount: ['金額', '料金', '会計金額'],
      staff_name: ['スタッフ', '担当者', '担当'],
      external_id: ['予約番号', '予約ID'],
      status: ['ステータス', '予約状況'],
      notes: ['備考', 'メモ', '要望'],
    },
  },
  minimo: {
    source: 'minimo',
    mapping: {
      reservation_at: ['予約日時', '日時'],
      reservation_date: ['予約日'],
      reservation_time: ['予約時間'],
      duration: ['所要時間'],
      customer_name: ['お客様名', '氏名'],
      customer_furigana: ['フリガナ', 'カナ'],
      customer_phone: ['電話番号'],
      menu: ['メニュー', 'コース'],
      amount: ['金額'],
      staff_name: ['担当', 'スタッフ'],
      external_id: ['予約ID', '予約番号'],
      notes: ['備考', 'メモ'],
    },
  },
  generic: {
    source: 'other',
    mapping: {
      reservation_at: ['日時', 'datetime', 'reservation_at'],
      reservation_date: ['日付', 'date'],
      reservation_time: ['時間', 'time'],
      duration: ['所要時間', 'duration'],
      customer_name: ['名前', '氏名', 'name'],
      customer_furigana: ['フリガナ', 'カナ'],
      customer_phone: ['電話番号', 'phone'],
      customer_email: ['メール', 'email'],
      menu: ['メニュー', 'menu'],
      amount: ['金額', 'amount', 'price'],
      staff_name: ['担当', 'スタッフ', 'staff'],
      external_id: ['ID', 'external_id'],
      status: ['状態', 'status'],
      notes: ['備考', 'notes', 'memo'],
    },
  },
};

function findColumn(
  headers: string[],
  candidates: string[],
): { index: number; key: string } | null {
  for (const cand of candidates) {
    const idx = headers.findIndex((h) => h === cand || h.replace(/\s+/g, '') === cand);
    if (idx !== -1) return { index: idx, key: cand };
  }
  return null;
}

function mapStatus(raw: string | undefined | null): ReservationStatus {
  const s = (raw ?? '').trim();
  if (!s) return 'confirmed';
  if (/(キャンセル|cancel)/i.test(s)) return 'cancelled';
  if (/(無断|no.?show|未来店)/i.test(s)) return 'no_show';
  if (/(完了|来店済|chez|complete)/i.test(s)) return 'completed';
  if (/(仮|pending|未確定)/i.test(s)) return 'pending';
  return 'confirmed';
}

export function transformWithPreset(
  text: string,
  presetKey: keyof typeof PRESETS,
): { reservations: ParsedReservation[]; errors: string[]; preset: string } {
  const preset = PRESETS[presetKey];
  const { headers, rows } = parseRows(text);
  const errors: string[] = [];
  const cols: Record<string, number> = {};
  for (const [field, candidates] of Object.entries(preset.mapping)) {
    const m = findColumn(headers, candidates);
    if (m) cols[field] = m.index;
  }

  // reservation_at が分離 (date+time) なら結合
  const reservations: ParsedReservation[] = [];
  rows.forEach((row, i) => {
    try {
      const get = (key: string) => (cols[key] !== undefined ? row[cols[key]] : '');

      let datetime = get('reservation_at');
      if (!datetime) {
        const date = get('reservation_date');
        const time = get('reservation_time');
        if (date && time) datetime = `${date} ${time}`;
        else if (date) datetime = `${date} 10:00`;
      }

      const iso = parseDateTime(datetime);
      if (!iso) {
        errors.push(`行 ${i + 2}: 日時を解析できませんでした (${datetime})`);
        return;
      }

      const customerName = get('customer_name');
      if (!customerName) {
        errors.push(`行 ${i + 2}: お客様名がありません`);
        return;
      }

      reservations.push({
        customer_name: customerName,
        customer_furigana: get('customer_furigana') || null,
        customer_phone: get('customer_phone') || null,
        customer_email: get('customer_email') || null,
        source: preset.source,
        external_id: get('external_id') || null,
        reservation_at: iso,
        duration_minutes: parseDuration(get('duration')),
        menu: get('menu') || null,
        amount: parseAmount(get('amount')),
        staff_name: get('staff_name') || null,
        status: mapStatus(get('status')),
        notes: get('notes') || null,
        source_data: Object.fromEntries(
          headers.map((h, idx) => [h, row[idx] ?? '']),
        ),
      });
    } catch (err) {
      errors.push(`行 ${i + 2}: ${err instanceof Error ? err.message : 'パース失敗'}`);
    }
  });

  return { reservations, errors, preset: presetKey };
}

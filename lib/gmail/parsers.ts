// Gmail 受信メール → 予約データ パーサ
// HPB / minimo の通知メールフォーマットを正規表現で解析

export interface ParsedReservationFromEmail {
  source: 'hpb' | 'minimo' | 'other';
  external_id: string | null;
  customer_name: string;
  customer_furigana: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  reservation_at: string; // ISO
  duration_minutes: number;
  menu: string | null;
  amount: number | null;
  staff_name: string | null;
  status: 'confirmed' | 'cancelled' | 'completed' | 'pending' | 'no_show';
  notes: string | null;
}

// 実メールではラベル行は ■ / ・ / 全角空白 / 括弧 などのプレフィクスを持ち、
// 値が同一行 (`ラベル：値`) と次行 (`ラベル\n　値`) のどちらでも現れる。
const PREFIX_CHARS = '[\\s　■□◆◇●○▼▲・◦※〇（(\\[]';

function getField(body: string, keywords: string[]): string | null {
  const kw = keywords
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  // ラベル後のスペース部分には改行を含めない (改行は次のグループで明示的に扱う)
  const re = new RegExp(
    `(?:^|\\n)${PREFIX_CHARS}*(?:${kw})[ \\t　]*(?:[：:][ \\t　]*([^\\n\\r]+)|\\n[ \\t　]+([^\\n\\r]+))`,
    'm',
  );
  const m = body.match(re);
  return (m?.[1] ?? m?.[2])?.trim() ?? null;
}

function parseJaDateTime(s: string): string | null {
  // 対応:
  //   2026/05/15 14:00
  //   2026-05-15 14:00
  //   2026年5月15日 14時00分
  //   2026年06月13日（土）13:15  ← HPB
  //   2026年5月1日（金）13:30    ← minimo
  const m = s.match(
    /(\d{4})[\/年-](\d{1,2})[\/月-](\d{1,2})日?(?:\s*[（(][^）)]*[）)])?\s*(\d{1,2})[時:](\d{1,2})/,
  );
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  // メール本文の日時は JST 表記なので、Vercel など UTC 環境でも正しく扱うため
  // JST = UTC+9 として明示的に換算する (new Date(y,m,d,h,mi) は実行環境のローカル TZ になってしまうため使わない)
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const ms =
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - jstOffsetMs;
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function parseDuration(s: string | null | undefined): number {
  if (!s) return 60;
  // "1時間45分" / "1時間" / "45分"
  const hm = s.match(/(\d+)\s*時間\s*(\d+)?\s*分?/);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2] || '0', 10);
  const m = s.match(/(\d+)\s*分/);
  if (m) return parseInt(m[1], 10);
  const num = parseInt(String(s).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(num) && num > 0 ? num : 60;
}

function parseAmount(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/[,，]/g, '').match(/(\d+)\s*円?/);
  return m ? parseInt(m[1], 10) : null;
}

// 「池端 美帆（イケハタ ミホ）」のように同一行で名前 + フリガナ併記の場合に分解
function splitNameFurigana(raw: string): { name: string; furigana: string | null } {
  const m = raw.match(/^(.+?)\s*[（(]([^）)]+)[)）]\s*$/);
  if (m) return { name: m[1].trim(), furigana: m[2].trim() };
  return { name: raw, furigana: null };
}

// HPB の ■合計金額 配下は複数サブ行 (予約時合計金額 / お支払い予定金額 …) なので個別に拾う
function findHpbAmount(body: string): number | null {
  const m = body.match(
    /(?:お支払い予定金額|予約時合計金額|合計金額|お支払い金額)[\s　:：]*([\d,，]+)\s*円/,
  );
  return m ? parseAmount(m[0]) : null;
}

// ===========================================================
// HPB (ホットペッパービューティー / サロンボード) の通知メール
// 件名例:
//   予約連絡
//   【ホットペッパービューティー】予約成立のお知らせ
//   サロンボード ご予約成立通知
// ===========================================================
export function parseHpbEmail(subject: string, body: string): ParsedReservationFromEmail | null {
  // 英語表記 (HOT PEPPER / SALON BOARD) も含めて広めに判定
  if (
    !/(ホットペッパー|サロンボード|HOT\s*PEPPER|SALON\s*BOARD|hotpepper|salonboard|HPB)/i.test(
      subject + body,
    )
  ) {
    return null;
  }

  const datetimeStr = getField(body, ['ご予約日時', '来店日時', 'ご予約日', '予約日時']);
  const reservationAt = datetimeStr ? parseJaDateTime(datetimeStr) : null;
  if (!reservationAt) return null;

  const rawName = getField(body, ['お客様氏名', 'お客様名', 'ご予約者', 'お名前', '氏名']);
  if (!rawName) return null;
  const { name, furigana: furiganaFromName } = splitNameFurigana(
    rawName.replace(/\s*(?:様|さま|さん)\s*$/, '').trim(),
  );

  const isCancel = /キャンセル|取消/.test(subject + body.slice(0, 400));
  const isNoShow = /無断/.test(subject + body.slice(0, 400));

  const emailField = getField(body, ['メール', 'Eメール', 'E-mail']);
  const emailMatch = emailField?.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);

  return {
    source: 'hpb',
    external_id:
      getField(body, ['予約番号', '予約ID', '予約No.', '予約No', 'ご予約番号'])?.split(/\s/)[0] ??
      null,
    customer_name: name,
    customer_furigana:
      getField(body, ['フリガナ', 'カナ', 'ふりがな'])
        ?.replace(/\s*(?:様|さま|さん)\s*$/, '')
        .trim() ?? furiganaFromName,
    customer_phone:
      getField(body, ['電話番号', 'お電話番号', 'TEL', '携帯'])?.replace(/[^\d\-+()]/g, '') || null,
    customer_email: emailMatch ? emailMatch[0] : null,
    reservation_at: reservationAt,
    duration_minutes: parseDuration(
      getField(body, ['所要時間目安', '所要時間', '施術時間', 'ご予約時間']),
    ),
    menu: getField(body, ['メニュー', 'ご来店メニュー', 'コース', '施術内容']),
    amount: findHpbAmount(body) ?? parseAmount(getField(body, ['金額', '料金', 'お会計'])),
    staff_name: getField(body, [
      '指名スタッフ',
      '担当スタッフ',
      '担当者',
      '担当',
      'スタイリスト',
      'スタッフ',
    ]),
    status: isNoShow ? 'no_show' : isCancel ? 'cancelled' : 'confirmed',
    notes: getField(body, ['ご要望・ご相談', 'ご要望', 'お客様要望', '備考', '要望']),
  };
}

// ===========================================================
// minimo の通知メール
// 件名例:
//   【ミニモ】予約成立のお知らせ
//   【ミニモ】xxx 様宛の新着メッセージのお知らせ (予約確定通知)
// ===========================================================
export function parseMinimoEmail(subject: string, body: string): ParsedReservationFromEmail | null {
  if (!/(minimo|ミニモ|minimodel|salontool)/i.test(subject + body)) return null;

  const datetimeStr = getField(body, ['ご予約日時', '予約日時', '来店日時', '日時']);
  const reservationAt = datetimeStr ? parseJaDateTime(datetimeStr) : null;
  if (!reservationAt) return null;

  const rawName = getField(body, ['お客様氏名', 'お客様名', 'ご予約者', 'お名前', '氏名', 'お客様']);
  if (!rawName) return null;
  const { name, furigana: furiganaFromName } = splitNameFurigana(
    rawName.replace(/\s*(?:様|さま|さん)\s*$/, '').trim(),
  );

  const isCancel = /キャンセル|取消/.test(subject + body.slice(0, 400));
  const isNoShow = /無断/.test(subject + body.slice(0, 400));

  const emailField = getField(body, ['メール', 'Eメール']);
  const emailMatch = emailField?.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);

  return {
    source: 'minimo',
    external_id:
      getField(body, ['予約番号', '予約ID', '予約No.', '予約No'])?.split(/\s/)[0] ?? null,
    customer_name: name,
    customer_furigana:
      getField(body, ['フリガナ', 'カナ'])
        ?.replace(/\s*(?:様|さま|さん)\s*$/, '')
        .trim() ?? furiganaFromName,
    customer_phone:
      getField(body, ['電話番号', 'TEL'])?.replace(/[^\d\-+()]/g, '') || null,
    customer_email: emailMatch ? emailMatch[0] : null,
    reservation_at: reservationAt,
    duration_minutes: parseDuration(getField(body, ['施術時間', '所要時間', '時間'])),
    menu: getField(body, ['メニュー', 'コース', '施術内容']),
    amount: parseAmount(getField(body, ['メニュー金額', '金額', '料金'])),
    staff_name: getField(body, ['担当者', '担当スタッフ', '担当', 'スタッフ']),
    status: isNoShow ? 'no_show' : isCancel ? 'cancelled' : 'confirmed',
    notes: getField(body, ['備考', 'お客様要望', '要望']),
  };
}

// 送信元・件名・本文から自動的に振り分け
export function dispatchEmail(
  sender: string,
  subject: string,
  body: string,
): { parsed: ParsedReservationFromEmail | null; parser: string | null } {
  const lc = (sender + ' ' + subject).toLowerCase();
  if (lc.includes('hotpepper') || lc.includes('hairsalons.beauty') || lc.includes('salonboard')) {
    return { parsed: parseHpbEmail(subject, body), parser: 'hpb' };
  }
  if (lc.includes('minimo')) {
    return { parsed: parseMinimoEmail(subject, body), parser: 'minimo' };
  }
  // 他の媒体は試しに両方
  const hpb = parseHpbEmail(subject, body);
  if (hpb) return { parsed: hpb, parser: 'hpb' };
  const mini = parseMinimoEmail(subject, body);
  if (mini) return { parsed: mini, parser: 'minimo' };
  return { parsed: null, parser: null };
}

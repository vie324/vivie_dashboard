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

// 共通ヘルパー
function parseJaDateTime(s: string): string | null {
  // 2026/05/15 14:00 / 2026年5月15日 14時00分 / 2026-05-15 14:00
  const m = s.match(
    /(\d{4})[\/年-](\d{1,2})[\/月-](\d{1,2})[日\s]+(\d{1,2})[時:](\d{1,2})/,
  );
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseDuration(s: string | null | undefined): number {
  if (!s) return 60;
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

// ===========================================================
// HPB (ホットペッパービューティー / サロンボード) の通知メール
// 件名例:
//   【ホットペッパービューティー】予約成立のお知らせ
//   【ホットペッパービューティー】キャンセルのお知らせ
//   サロンボード ご予約成立通知
// 本文例 (代表的なテンプレ、実装側でフレキシブルに):
//   ご予約日時: 2026年05月15日(金) 14:00
//   ご予約時間: 60分
//   お客様氏名: 山田 花子 様
//   お客様氏名(フリガナ): ヤマダ ハナコ 様
//   電話番号: 090-1234-5678
//   メニュー: ハイドラフェイシャル + 小顔矯正
//   担当: 粟田 麻央
//   予約番号: HPBR-XXXXXXXXXX
// ===========================================================
export function parseHpbEmail(subject: string, body: string): ParsedReservationFromEmail | null {
  if (!/(ホットペッパー|サロンボード)/.test(subject + body) && !/HPB/i.test(subject)) {
    return null;
  }

  const get = (re: RegExp) => {
    const m = body.match(re);
    return m?.[1]?.trim() ?? null;
  };

  const datetimeStr =
    get(/(?:ご予約日時|来店日時|ご予約日|予約日時)\s*[::]\s*([^\n\r]+)/);
  const reservationAt = datetimeStr ? parseJaDateTime(datetimeStr) : null;
  if (!reservationAt) return null;

  const customerName =
    get(/(?:お客様氏名|お客様名|ご予約者|お名前)\s*[::]\s*([^\n\r]+?)\s*様?/) ?? '';
  if (!customerName) return null;

  const isCancel = /キャンセル|取消/.test(subject + body.slice(0, 200));
  const isNoShow = /無断/.test(subject + body.slice(0, 200));

  return {
    source: 'hpb',
    external_id: get(/(?:予約番号|予約ID|予約No\.?|ご予約番号)\s*[::]\s*([^\s\n\r]+)/),
    customer_name: customerName,
    customer_furigana: get(/(?:フリガナ|カナ|ふりがな)\s*[::]\s*([^\n\r]+?)\s*様?/),
    customer_phone: get(/(?:電話番号|お電話番号|TEL|携帯)\s*[::]\s*([0-9\-+()\s]+)/)?.trim() ?? null,
    customer_email: get(/(?:メール|Eメール|E-mail)\s*[::]\s*([\w.+-]+@[\w-]+\.[\w.-]+)/),
    reservation_at: reservationAt,
    duration_minutes: parseDuration(get(/(?:ご予約時間|所要時間|施術時間)\s*[::]\s*([^\n\r]+)/)),
    menu: get(/(?:メニュー|ご来店メニュー|コース|施術内容)\s*[::]\s*([^\n\r]+)/),
    amount: parseAmount(get(/(?:金額|料金|合計|お会計)\s*[::]\s*([^\n\r]+)/)),
    staff_name: get(/(?:担当|スタイリスト|担当者)\s*[::]\s*([^\n\r]+)/),
    status: isNoShow ? 'no_show' : isCancel ? 'cancelled' : 'confirmed',
    notes: get(/(?:備考|お客様要望|要望)\s*[::]\s*([^\n\r]+)/),
  };
}

// ===========================================================
// minimo の通知メール
// 件名例:
//   【minimo】予約成立のお知らせ
//   【minimo】予約キャンセルのお知らせ
// 本文例:
//   予約番号: M-XXXXX
//   ご予約日時: 2026年5月15日(金) 14:00
//   お客様: 山田 花子 さま
//   電話番号: 090-1234-5678
//   メニュー: ...
// ===========================================================
export function parseMinimoEmail(subject: string, body: string): ParsedReservationFromEmail | null {
  if (!/minimo/i.test(subject + body.slice(0, 500))) return null;

  const get = (re: RegExp) => {
    const m = body.match(re);
    return m?.[1]?.trim() ?? null;
  };

  const datetimeStr = get(/(?:ご予約日時|予約日時|日時)\s*[::]\s*([^\n\r]+)/);
  const reservationAt = datetimeStr ? parseJaDateTime(datetimeStr) : null;
  if (!reservationAt) return null;

  const customerName =
    get(/(?:お客様|お客様名|ご予約者|お名前)\s*[::]\s*([^\n\r]+?)\s*(?:さま|さん|様)?$/m) ?? '';
  if (!customerName) return null;

  const isCancel = /キャンセル|取消/.test(subject + body.slice(0, 200));
  const isNoShow = /無断/.test(subject + body.slice(0, 200));

  return {
    source: 'minimo',
    external_id: get(/(?:予約番号|予約ID|予約No)\s*[::]\s*([^\s\n\r]+)/),
    customer_name: customerName,
    customer_furigana: get(/(?:フリガナ|カナ)\s*[::]\s*([^\n\r]+?)\s*(?:さま|さん|様)?$/m),
    customer_phone: get(/(?:電話番号|TEL)\s*[::]\s*([0-9\-+()\s]+)/)?.trim() ?? null,
    customer_email: get(/(?:メール|Eメール)\s*[::]\s*([\w.+-]+@[\w-]+\.[\w.-]+)/),
    reservation_at: reservationAt,
    duration_minutes: parseDuration(get(/(?:所要時間|施術時間|時間)\s*[::]\s*([^\n\r]+)/)),
    menu: get(/(?:メニュー|コース|施術内容)\s*[::]\s*([^\n\r]+)/),
    amount: parseAmount(get(/(?:金額|料金)\s*[::]\s*([^\n\r]+)/)),
    staff_name: get(/(?:担当|スタッフ)\s*[::]\s*([^\n\r]+)/),
    status: isNoShow ? 'no_show' : isCancel ? 'cancelled' : 'confirmed',
    notes: get(/(?:備考|お客様要望)\s*[::]\s*([^\n\r]+)/),
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

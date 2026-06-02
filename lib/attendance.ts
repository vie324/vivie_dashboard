import type { AttendanceKind } from '@/types/database';

// 勤怠の打刻種別ラベル (出退勤・休憩)。
// 以前は 4 ファイルで重複定義されていたものをここに集約。
export const kindLabel: Record<AttendanceKind, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};

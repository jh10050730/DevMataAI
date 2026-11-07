/** 날짜 유틸 — 모두 브라우저 로컬 시간대 기준 */
const DAY = 86_400_000;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
/** 주의 시작 = 일요일 */
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -d.getDay());

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** 월간 달력용 6주(42일) 그리드 */
export function monthGrid(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export const weekDays = (d: Date) => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(d), i));

/** 일정이 해당 날짜에 걸쳐 있는지 */
export function overlapsDay(startAt: string, endAt: string, day: Date) {
  const s = new Date(startAt).getTime();
  const e = new Date(endAt).getTime();
  const ds = startOfDay(day).getTime();
  return s < ds + DAY && (e > ds || s === e && s >= ds);
}

const pad = (n: number) => String(n).padStart(2, '0');
/** <input type="datetime-local"> 값 */
export const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** <input type="date"> 값 */
export const toDateInput = (d: Date) => toLocalInput(d).slice(0, 10);

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
export const fmtFullDate = (d: Date) =>
  d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

/** 마감일 라벨: 지남 / 오늘 / D-n */
export function dueLabel(dueIso: string, now = new Date()): { text: string; tone: 'overdue' | 'today' | 'soon' | 'normal' } {
  const due = new Date(dueIso);
  const diff = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / DAY);
  if (due < now && diff <= 0) return { text: diff === 0 ? '오늘 (지남)' : `${-diff}일 지남`, tone: 'overdue' };
  if (diff === 0) return { text: `오늘 ${fmtTime(dueIso)}`, tone: 'today' };
  if (diff <= 2) return { text: `D-${diff}`, tone: 'soon' };
  return { text: fmtDate(due), tone: 'normal' };
}

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

/** 지금 시간대. 브리핑 문구를 맞춘다 (오후에 "아침 브리핑"이라고 하면 어색하다) */
export function dayPart(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? '새벽' : h < 10 ? '아침' : h < 12 ? '오전' : h < 18 ? '오후' : '저녁';
}

/** AI 비서에게 보내는 오늘 브리핑 요청. 하루가 시작되기 전(새벽·아침)이면 하루 전체, 그 뒤면 남은 시간 기준으로 부탁한다 */
export function briefingRequest(d = new Date()) {
  const part = dayPart(d);
  return part === '새벽' || part === '아침'
    ? `오늘의 ${part} 브리핑을 해줘. 일정·할 일·복습·프로젝트·뉴스를 근거로 오늘 우선순위를 제안해줘.`
    : `지금은 ${part}이야. 오늘 ${part} 브리핑을 해줘. 이미 지난 일정은 빼고, 남은 일정·할 일·복습·프로젝트·뉴스를 근거로 남은 시간의 우선순위를 제안해줘.`;
}

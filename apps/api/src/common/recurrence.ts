/**
 * 반복 일정·할 일 계산. 날짜는 한국 시간(UTC+9, 서머타임 없음) 달력을 기준으로 센다.
 * - DAILY: 매일, WEEKDAYS: 평일(월~금), WEEKLY: 매주 같은 요일, MONTHLY: 매월 같은 날짜 (그 날짜가 없는 달은 건너뜀)
 */
export const REPEATS = ['DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY'] as const;
export type Repeat = (typeof REPEATS)[number];
export const REPEAT_LABEL: Record<Repeat, string> = { DAILY: '매일', WEEKDAYS: '평일마다', WEEKLY: '매주', MONTHLY: '매월' };

const KST = 9 * 3_600_000;
const DAY = 86_400_000;
/** 한 번에 펼치는 회차 상한 (달력 한 화면·하루치 조회에는 충분하다) */
export const MAX_OCCURRENCES = 1000;

export const isRepeat = (value: unknown): value is Repeat => typeof value === 'string' && (REPEATS as readonly string[]).includes(value);

/** 한국 시간 기준 요일 (0=일요일) */
const kstWeekday = (t: number) => new Date(t + KST).getUTCDay();

/** start 에서 n달 뒤 같은 날짜·시각. 그 날짜가 없는 달(예: 31일)이면 null */
function addMonths(start: number, n: number): number | null {
  const k = new Date(start + KST);
  const day = k.getUTCDate();
  const shifted = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + n, day, k.getUTCHours(), k.getUTCMinutes(), k.getUTCSeconds(), k.getUTCMilliseconds()));
  if (shifted.getUTCDate() !== day) return null;
  return shifted.getTime() - KST;
}

/**
 * [from, to) 와 겹치는 회차의 시작 시각들 (오래된 순).
 * durationMs: 한 회차의 길이 (일정 종료 - 시작). until: 이 시각 뒤에 시작하는 회차는 없음.
 */
export function occurrences(start: Date, repeat: Repeat, from: Date, to: Date, { durationMs = 0, until = null as Date | null, limit = MAX_OCCURRENCES } = {}): Date[] {
  const s = start.getTime();
  const lo = from.getTime() - durationMs; // 이보다 늦게 시작해야 from 이후에 끝난다
  const hi = Math.min(to.getTime(), until ? until.getTime() + 1 : Infinity);
  const out: Date[] = [];
  const push = (t: number) => {
    // 길이가 0인 회차(마감 시각)는 from 에 시작해도 포함
    const overlaps = durationMs > 0 ? t > lo : t >= from.getTime();
    if (t >= s && t < hi && overlaps) out.push(new Date(t));
  };
  if (repeat === 'MONTHLY') {
    const first = new Date(s + KST);
    const target = new Date(Math.max(lo, s) + KST);
    let n = Math.max(0, (target.getUTCFullYear() - first.getUTCFullYear()) * 12 + target.getUTCMonth() - first.getUTCMonth() - 1);
    for (let guard = 0; out.length < limit && guard < limit * 2 + 24; n++, guard++) {
      const t = addMonths(s, n);
      if (t === null) continue;
      if (t >= hi) break;
      push(t);
    }
    return out;
  }
  const step = repeat === 'WEEKLY' ? 7 * DAY : DAY;
  let n = Math.max(0, Math.floor((lo - s) / step));
  for (let guard = 0; out.length < limit && guard < limit * 3 + 10; n++, guard++) {
    const t = s + n * step;
    if (t >= hi) break;
    if (repeat === 'WEEKDAYS' && [0, 6].includes(kstWeekday(t))) continue;
    push(t);
  }
  return out;
}

/** after 보다 뒤에 오는 첫 회차 (반복 할 일의 다음 마감일). 끝이 없으므로 항상 있다 */
export function nextOccurrence(start: Date, repeat: Repeat, after: Date): Date {
  const base = Math.max(after.getTime(), start.getTime()) + 1;
  // 넉넉한 구간에서 첫 회차를 찾는다 (매월 31일처럼 건너뛰는 달이 있어도 1년 안에는 반드시 있다)
  const [first] = occurrences(start, repeat, new Date(base), new Date(base + 400 * DAY), { limit: 1 });
  return first;
}

type Repeating = { startAt: Date; endAt: Date; repeat: string | null; repeatUntil: Date | null };
/**
 * 일정 목록을 [from, to) 범위의 회차로 펼친다. 반복 일정의 회차는 id 가 같고
 * series(원래 시작·종료)를 함께 돌려줘서 화면이 수정할 때 원래 일정 기준으로 옮길 수 있게 한다.
 */
export function expandEvents<T extends Repeating>(events: T[], from: Date, to: Date): (T & { series?: { startAt: Date; endAt: Date } })[] {
  const out: (T & { series?: { startAt: Date; endAt: Date } })[] = [];
  for (const event of events) {
    if (!isRepeat(event.repeat)) { if (event.startAt < to && event.endAt > from) out.push(event); continue; }
    const duration = event.endAt.getTime() - event.startAt.getTime();
    for (const at of occurrences(event.startAt, event.repeat, from, to, { durationMs: duration, until: event.repeatUntil })) {
      out.push({ ...event, startAt: at, endAt: new Date(at.getTime() + duration), series: { startAt: event.startAt, endAt: event.endAt } });
    }
  }
  return out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** DB 조회 조건: 범위와 겹치는 단일 일정 + 범위 안에 회차가 있을 수 있는 반복 일정 */
export function eventRangeWhere(from: Date, to: Date) {
  return {
    OR: [
      { repeat: null, startAt: { lt: to }, endAt: { gt: from } },
      { repeat: { not: null }, startAt: { lt: to }, OR: [{ repeatUntil: null }, { repeatUntil: { gte: new Date(from.getTime() - 400 * DAY) } }] },
    ],
  };
}

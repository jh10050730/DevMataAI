/** 매일 브리핑 규칙 (시간은 모두 한국 시간) */

/** 이 시각부터는 그날 브리핑을 보내지 않는다 (저녁에 처음 켰는데 "아침 브리핑"이 오면 어색하다) */
export const BRIEFING_END_HOUR = 18;
export const MAX_LINES = 3;
const MAX_LINE = 90;

export const kstHour = (now: Date) => new Date(now.getTime() + 9 * 3_600_000).getUTCHours();

/** 지금 시간대 (한국 시간). 브리핑 제목과 AI 말투를 여기에 맞춘다: 오후에 "아침 브리핑"이 오면 어색하다 */
export type DayPart = '새벽' | '아침' | '오전' | '오후' | '저녁';
export const dayPart = (now: Date): DayPart => { const h = kstHour(now); return h < 5 ? '새벽' : h < 10 ? '아침' : h < 12 ? '오전' : h < 18 ? '오후' : '저녁'; };
const TITLE: Record<DayPart, string> = { 새벽: '🌌 새벽 브리핑', 아침: '🌅 아침 브리핑', 오전: '☀️ 오전 브리핑', 오후: '🌤️ 오후 브리핑', 저녁: '🌙 저녁 브리핑' };
export const briefingTitle = (now: Date) => TITLE[dayPart(now)];

/** 오늘 브리핑을 보낼 때인지: 정한 시각을 지났고, 저녁 전이고, 오늘 아직 안 보냈을 때 */
export function briefingDue(now: Date, hour: number, sentToday: boolean) {
  const h = kstHour(now);
  return !sentToday && h >= hour && h < Math.max(BRIEFING_END_HOUR, hour + 1);
}

export type BriefingFacts = {
  events: { title: string; startAt: Date; allDay: boolean }[];
  dueToday: string[];
  overdue: string[];
  reviews: number;
  news: string[];
};

const clock = (d: Date) => d.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const listed = (items: string[], max = 2) => items.slice(0, max).join(', ') + (items.length > max ? ` 외 ${items.length - max}개` : '');

export const isEmptyDay = (f: BriefingFacts) => !f.events.length && !f.dueToday.length && !f.overdue.length && !f.reviews;

/** 이미 시작한 일정은 뺀다 (종일 일정은 남긴다). 몇 시에 받든 앞으로 남은 것만 알린다 */
export const remainingEvents = (events: BriefingFacts['events'], now: Date) => events.filter(e => e.allDay || e.startAt >= now);

/** AI 없이 만드는 브리핑 (최대 3줄). 이미 시작한 일정이 있으면 빼고 "남은 일정"으로 알린다 */
export function fallbackBriefing(f: BriefingFacts, now?: Date) {
  const events = now ? remainingEvents(f.events, now) : f.events;
  const partial = events.length < f.events.length;
  if (isEmptyDay({ ...f, events })) return partial ? '오늘 남은 일정과 마감이 없어요. 남은 시간 여유롭게 보내세요!' : '오늘은 등록된 일정과 마감이 없어요. 여유로운 하루 보내세요!';
  const lines: string[] = [];
  if (events.length) lines.push(`📅 ${partial ? '남은 일정' : '일정'} ${events.length}개: ${listed(events.map(e => e.allDay ? `${e.title}(종일)` : `${clock(e.startAt)} ${e.title}`))}`);
  if (f.dueToday.length || f.overdue.length) lines.push(`✅ ${[f.dueToday.length && `오늘 마감 ${listed(f.dueToday)}`, f.overdue.length && `지난 마감 ${f.overdue.length}개`].filter(Boolean).join(' · ')}`);
  if (f.reviews) lines.push(`📖 복습할 노트 ${f.reviews}개`);
  return clipLines(lines.join('\n'));
}

/** AI 답을 알림에 맞게: 빈 줄·Markdown 기호를 걷고 최대 3줄, 줄마다 너무 길면 자른다 */
export function clipLines(text: string, maxLines = MAX_LINES) {
  return text.replace(/```[\s\S]*?```/g, '').split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').replace(/\*\*|__|`|^#+\s*/g, '').trim())
    .filter(Boolean).slice(0, maxLines)
    .map(line => line.length > MAX_LINE ? `${line.slice(0, MAX_LINE - 1)}…` : line)
    .join('\n');
}

/** 아침 브리핑 규칙 (시간은 모두 한국 시간) */

/** 이 시각부터는 그날 브리핑을 보내지 않는다 (저녁에 처음 켰는데 "아침 브리핑"이 오면 어색하다) */
export const BRIEFING_END_HOUR = 18;
export const MAX_LINES = 3;
const MAX_LINE = 90;

export const kstHour = (now: Date) => new Date(now.getTime() + 9 * 3_600_000).getUTCHours();

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

/** AI 없이 만드는 브리핑 (최대 3줄) */
export function fallbackBriefing(f: BriefingFacts) {
  if (isEmptyDay(f)) return '오늘은 등록된 일정과 마감이 없어요. 여유로운 하루 보내세요!';
  const lines: string[] = [];
  if (f.events.length) lines.push(`📅 일정 ${f.events.length}개: ${listed(f.events.map(e => e.allDay ? `${e.title}(종일)` : `${clock(e.startAt)} ${e.title}`))}`);
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

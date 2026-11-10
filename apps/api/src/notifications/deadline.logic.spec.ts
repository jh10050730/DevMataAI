import { deadlineMilestone, eventDeadline, monthBefore } from './deadline.logic';
describe('deadline reminder dates', () => {
  it('한 달 전은 한국 시간 기준 전월 같은 날, 없는 날짜는 말일', () => {
    expect(monthBefore(new Date('2027-03-31T09:30:00+09:00')).toISOString()).toBe('2027-02-28T00:30:00.000Z');
    expect(monthBefore(new Date('2028-03-31T00:15:00+09:00')).toISOString()).toBe('2028-02-28T15:15:00.000Z');
    expect(monthBefore(new Date('2027-01-01T09:00:00+09:00')).toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
  it('각 경계에서 정확한 단계 하나만 선택하고 지난 마감은 제외', () => {
    const due = new Date('2027-05-31T00:00:00Z');
    expect(deadlineMilestone(due, new Date('2027-04-29T23:59:59Z'))).toBeNull();
    expect(deadlineMilestone(due, monthBefore(due))?.key).toBe('MONTH');
    for (const [days, key] of [[21, 'THREE_WEEKS'], [7, 'WEEK'], [1, 'DAY']] as const) expect(deadlineMilestone(due, new Date(due.getTime() - days * 86400000))?.key).toBe(key);
    expect(deadlineMilestone(due, new Date(due.getTime() - 3 * 86400000))?.key).toBe('WEEK');
    expect(deadlineMilestone(due, due)).toBeNull();
  });
  it('종일 일정의 마지막 날 자정 직전이 마감', () => {
    expect(eventDeadline({ endAt: new Date('2027-01-03T00:00:00+09:00'), allDay: true }).toISOString()).toBe('2027-01-02T14:59:59.999Z');
  });
});

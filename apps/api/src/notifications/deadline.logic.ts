const DAY = 86400000;
export function monthBefore(deadline: Date) {
  const local = new Date(deadline.getTime() + 9 * 3600000);
  const year = local.getUTCFullYear(), month = local.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(local.getUTCDate(), lastDay), local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds()) - 9 * 3600000);
}
/** 끝내지 않은 할 일은 마감이 지난 뒤 이 기간 안에 앱이 켜지면 "마감 지남" 을 한 번 알린다 (PC가 꺼져 있어 하루 전 알림을 놓친 경우) */
export const OVERDUE_WINDOW_MS = 3 * DAY;
export function deadlineMilestone(deadline: Date, now: Date, { overdue = false } = {}) {
  if (deadline <= now) return overdue && now.getTime() - deadline.getTime() < OVERDUE_WINDOW_MS ? { key: 'OVERDUE', label: '지남', at: deadline } : null;
  // When the server resumes, only the most relevant missed reminder is created.
  const stages = [
    { key: 'DAY', label: '하루 전', at: new Date(deadline.getTime() - DAY) },
    { key: 'WEEK', label: '1주 전', at: new Date(deadline.getTime() - 7 * DAY) },
    { key: 'THREE_WEEKS', label: '3주 전', at: new Date(deadline.getTime() - 21 * DAY) },
    { key: 'MONTH', label: '한 달 전', at: monthBefore(deadline) },
  ];
  return stages.find(stage => now >= stage.at) ?? null;
}
export function eventDeadline(event: { endAt: Date; allDay: boolean }) {
  // All-day events store an exclusive midnight end; remind for the final included day.
  return new Date(event.endAt.getTime() - (event.allDay ? 1 : 0));
}

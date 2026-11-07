export function koreanDay(now = new Date()) { return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10); }
export function koreanDayStart(now = new Date()) { return new Date(koreanDay(now) + 'T00:00:00+09:00'); }
export function nextCollection(now = new Date()) {
  const today = new Date(koreanDay(now) + 'T07:00:00+09:00');
  return new Date(today.getTime() > now.getTime() ? today.getTime() : today.getTime() + 86400000);
}
export function shouldCollect(now: Date, completedDay?: string | null, lastAttemptAt?: Date | null) {
  return now.getTime() >= new Date(koreanDay(now) + 'T07:00:00+09:00').getTime()
    && completedDay !== koreanDay(now)
    && (!lastAttemptAt || now.getTime() - lastAttemptAt.getTime() >= 1800000);
}

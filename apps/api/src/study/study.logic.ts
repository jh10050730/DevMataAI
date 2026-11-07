export const REVIEW_DAYS = [1, 3, 7, 14, 30, 60];
export function reviewSchedule(count: number, rating: string, now = new Date()) {
  const days = rating === 'again' ? 1 : rating === 'hard' ? 2
    : REVIEW_DAYS[Math.min(count + (rating === 'easy' ? 1 : 0), REVIEW_DAYS.length - 1)];
  return new Date(now.getTime() + days * 86400000);
}
export function normalizeTags(tags: string[]) {
  return [...new Set(tags.map(t => t.trim()).filter(Boolean))];
}
export function notionPageId(value: string) {
  const match = value.split('?')[0].match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})(?:$|\/)/i);
  if (!match) return null;
  return match[1].replace(/-/g, '').toLowerCase();
}

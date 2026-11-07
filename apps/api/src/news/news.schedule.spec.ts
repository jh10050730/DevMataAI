import { koreanDay, koreanDayStart, nextCollection, shouldCollect } from './news.schedule';
describe('한국 시간 일일 수집', () => {
  it('한국 자정과 UTC 날짜 경계를 구분', () => {
    expect(koreanDay(new Date('2026-11-07T16:00:00Z'))).toBe('2026-11-08');
    expect(koreanDayStart(new Date('2026-11-07T16:00:00Z')).toISOString()).toBe('2026-11-07T15:00:00.000Z');
  });
  it('7시 전에는 대기하고 7시 이후 놓친 수집을 실행', () => {
    expect(shouldCollect(new Date('2026-11-06T21:59:00Z'))).toBe(false);
    expect(shouldCollect(new Date('2026-11-06T22:00:00Z'))).toBe(true);
    expect(shouldCollect(new Date('2026-11-07T08:00:00Z'), '2026-11-07')).toBe(false);
  });
  it('실패 시 30분 간격으로 재시도하고 다음 날 일정을 계산', () => {
    const now = new Date('2026-11-07T08:00:00Z');
    expect(shouldCollect(now, null, new Date('2026-11-07T07:45:00Z'))).toBe(false);
    expect(shouldCollect(now, null, new Date('2026-11-07T07:30:00Z'))).toBe(true);
    expect(nextCollection(now).toISOString()).toBe('2026-11-07T22:00:00.000Z');
  });
});

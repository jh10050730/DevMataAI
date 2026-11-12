import { describe, expect, it } from 'vitest';
import { dueLabel, monthGrid, overlapsDay, startOfWeek, toLocalInput, briefingRequest, dayPart } from './date';

describe('date utils', () => {
  it('monthGrid 는 일요일부터 42일', () => {
    const grid = monthGrid(new Date(2026, 10, 15)); // 2026년 11월
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(0);
    expect(grid[0].getDate()).toBe(1); // 2026-11-01 은 일요일
  });

  it('startOfWeek 는 일요일 자정', () => {
    const s = startOfWeek(new Date(2026, 10, 7, 15, 30)); // 토요일
    expect(s).toEqual(new Date(2026, 10, 1));
  });

  it('overlapsDay: 여러 날 걸친 일정 포함', () => {
    const start = new Date(2026, 10, 6, 22).toISOString();
    const end = new Date(2026, 10, 7, 2).toISOString();
    expect(overlapsDay(start, end, new Date(2026, 10, 6))).toBe(true);
    expect(overlapsDay(start, end, new Date(2026, 10, 7))).toBe(true);
    expect(overlapsDay(start, end, new Date(2026, 10, 8))).toBe(false);
  });

  it('dueLabel: 지남 / 오늘 / D-n', () => {
    const now = new Date(2026, 10, 7, 12);
    expect(dueLabel(new Date(2026, 10, 5, 9).toISOString(), now).tone).toBe('overdue');
    expect(dueLabel(new Date(2026, 10, 7, 18).toISOString(), now).tone).toBe('today');
    expect(dueLabel(new Date(2026, 10, 9, 9).toISOString(), now)).toEqual({ text: 'D-2', tone: 'soon' });
    expect(dueLabel(new Date(2026, 10, 20, 9).toISOString(), now).tone).toBe('normal');
  });

  it('toLocalInput 형식', () => {
    expect(toLocalInput(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });
});

describe('브리핑 시간대', () => {
  it('아침·오후·저녁에 맞춰 브리핑 요청 문구를 바꾼다', () => {
    const at = (h: number) => new Date(2026, 10, 13, h, 0);
    expect([3, 8, 11, 12, 19].map(h => dayPart(at(h)))).toEqual(['새벽', '아침', '오전', '오후', '저녁']);
    expect(briefingRequest(at(8))).toContain('아침 브리핑');
    expect(briefingRequest(at(11))).toContain('오전 브리핑');
    expect(briefingRequest(at(11))).toContain('이미 지난 일정은 빼고');
    expect(briefingRequest(at(15))).toContain('오후 브리핑');
    expect(briefingRequest(at(15))).not.toContain('아침');
  });
});

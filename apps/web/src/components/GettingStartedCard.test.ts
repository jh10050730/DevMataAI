import { describe, expect, it } from 'vitest';
import { STEPS, allDone, type GettingStarted } from './GettingStartedCard';

const none: GettingStarted = { ai: false, task: false, event: false, note: false, project: false, google: false };

describe('처음 해 볼 일', () => {
  it('선택 항목(Google)을 빼고 모두 하면 완료', () => {
    expect(allDone(none)).toBe(false);
    expect(allDone({ ...none, ai: true, task: true, event: true, note: true, project: true })).toBe(true);
    expect(allDone({ ...none, ai: true, task: true, event: true, note: true, google: true })).toBe(false);
  });
  it('모든 항목이 앱 안 화면으로 연결되고 응답 키와 맞음', () => {
    expect(STEPS.map(s => s.key).sort()).toEqual(Object.keys(none).sort());
    for (const step of STEPS) expect(step.to).toMatch(/^\/[a-z]*$/);
    expect(STEPS.filter(s => s.optional).map(s => s.key)).toEqual(['google']);
  });
});

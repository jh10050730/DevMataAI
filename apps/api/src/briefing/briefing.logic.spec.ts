import { briefingTitle, dayPart, fallbackBriefing, type BriefingFacts } from './briefing.logic';

const kst = (s: string) => new Date(`${s}:00+09:00`);
const facts = (over: Partial<BriefingFacts> = {}): BriefingFacts => ({ events: [], dueToday: [], overdue: [], reviews: 0, news: [], ...over });

describe('브리핑 시간대', () => {
  it('한국 시간으로 아침·오후·저녁을 나누고 제목을 맞춘다', () => {
    const parts = ['03:00', '05:00', '09:59', '10:00', '11:59', '12:00', '17:59', '18:30'].map(t => dayPart(kst(`2026-11-13T${t}`)));
    expect(parts).toEqual(['새벽', '아침', '아침', '오전', '오전', '오후', '오후', '저녁']);
    expect(briefingTitle(kst('2026-11-13T08:00'))).toBe('🌅 아침 브리핑');
    expect(briefingTitle(kst('2026-11-13T11:00'))).toBe('☀️ 오전 브리핑');
    expect(briefingTitle(kst('2026-11-13T15:00'))).toBe('🌤️ 오후 브리핑');
  });

  it('몇 시에 받든 이미 시작한 일정은 빼고 남은 일정만 알린다', () => {
    const f = facts({ events: [
      { title: '스탠드업', startAt: kst('2026-11-13T09:00'), allDay: false },
      { title: '치과', startAt: kst('2026-11-13T16:00'), allDay: false },
      { title: '휴가', startAt: kst('2026-11-13T00:00'), allDay: true },
    ] });
    expect(fallbackBriefing(f, kst('2026-11-13T08:00'))).toBe('📅 일정 3개: 09:00 스탠드업, 16:00 치과 외 1개');
    expect(fallbackBriefing(f, kst('2026-11-13T11:00'))).toBe('📅 남은 일정 2개: 16:00 치과, 휴가(종일)'); // 오전: 9시 스탠드업은 지남
    expect(fallbackBriefing(f, kst('2026-11-13T14:00'))).toBe('📅 남은 일정 2개: 16:00 치과, 휴가(종일)');
    const past = facts({ events: [{ title: '스탠드업', startAt: kst('2026-11-13T09:00'), allDay: false }] });
    expect(fallbackBriefing(past, kst('2026-11-13T14:00'))).toBe('오늘 남은 일정과 마감이 없어요. 남은 시간 여유롭게 보내세요!');
  });
});

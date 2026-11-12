import { expandEvents, nextOccurrence, occurrences } from './recurrence';

const kst = (s: string) => new Date(`${s}+09:00`);
const iso = (dates: Date[]) => dates.map(d => new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 16));

describe('반복 계산 (한국 시간 기준)', () => {
  it('매일: 범위 안의 회차만 펼친다', () => {
    expect(iso(occurrences(kst('2026-11-10T09:00'), 'DAILY', kst('2026-11-12T00:00'), kst('2026-11-14T00:00')))).toEqual(['2026-11-12T09:00', '2026-11-13T09:00']);
  });
  it('평일: 토·일요일을 건너뛴다 (2026-11-14 토, 15 일)', () => {
    expect(iso(occurrences(kst('2026-11-13T08:00'), 'WEEKDAYS', kst('2026-11-13T00:00'), kst('2026-11-18T00:00')))).toEqual(['2026-11-13T08:00', '2026-11-16T08:00', '2026-11-17T08:00']);
  });
  it('매주: 같은 요일·시각', () => {
    expect(iso(occurrences(kst('2026-11-02T10:00'), 'WEEKLY', kst('2026-11-01T00:00'), kst('2026-12-01T00:00')))).toEqual(['2026-11-02T10:00', '2026-11-09T10:00', '2026-11-16T10:00', '2026-11-23T10:00', '2026-11-30T10:00']);
  });
  it('매월: 31일이 없는 달은 건너뛴다', () => {
    expect(iso(occurrences(kst('2026-01-31T12:00'), 'MONTHLY', kst('2026-01-01T00:00'), kst('2026-06-01T00:00')))).toEqual(['2026-01-31T12:00', '2026-03-31T12:00', '2026-05-31T12:00']);
  });
  it('반복 끝 뒤의 회차는 없다', () => {
    expect(iso(occurrences(kst('2026-11-10T09:00'), 'DAILY', kst('2026-11-10T00:00'), kst('2026-11-20T00:00'), { until: kst('2026-11-11T23:59') }))).toEqual(['2026-11-10T09:00', '2026-11-11T09:00']);
  });
  it('범위 시작 전에 시작해 범위 안에서 끝나는 회차도 포함한다', () => {
    const out = occurrences(kst('2026-11-10T23:00'), 'DAILY', kst('2026-11-12T00:00'), kst('2026-11-13T00:00'), { durationMs: 2 * 3600000 });
    expect(iso(out)).toEqual(['2026-11-11T23:00', '2026-11-12T23:00']);
  });
  it('다음 마감일: 일찍 끝내면 다음 회차, 늦게 끝내면 지금 이후 첫 회차', () => {
    expect(iso([nextOccurrence(kst('2026-11-20T18:00'), 'WEEKLY', kst('2026-11-12T10:00'))])).toEqual(['2026-11-27T18:00']);
    expect(iso([nextOccurrence(kst('2026-11-01T18:00'), 'DAILY', kst('2026-11-12T10:00'))])).toEqual(['2026-11-12T18:00']);
    expect(iso([nextOccurrence(kst('2026-11-13T09:00'), 'WEEKDAYS', kst('2026-11-13T09:00'))])).toEqual(['2026-11-16T09:00']);
  });
  it('일정 펼치기: 단일 일정은 그대로, 반복 일정은 회차마다 원래 일정 정보를 단다', () => {
    const single = { id: 'a', startAt: kst('2026-11-12T10:00'), endAt: kst('2026-11-12T11:00'), repeat: null, repeatUntil: null };
    const weekly = { id: 'b', startAt: kst('2026-11-05T09:00'), endAt: kst('2026-11-05T09:30'), repeat: 'WEEKLY', repeatUntil: null };
    const out = expandEvents([single, weekly], kst('2026-11-12T00:00'), kst('2026-11-13T00:00'));
    expect(out.map(e => [e.id, iso([e.startAt])[0], !!e.series])).toEqual([['b', '2026-11-12T09:00', true], ['a', '2026-11-12T10:00', false]]);
    expect(out[0].series?.startAt).toEqual(weekly.startAt);
  });
});

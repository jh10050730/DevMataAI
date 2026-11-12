import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Details from './AssistantActionDetails';
const render = (payload: unknown) => renderToStaticMarkup(createElement(Details, { payload: typeof payload === 'string' ? payload : JSON.stringify(payload) }));
describe('assistant calendar previews', () => {
  it('displays timed events in Korean time with the place and description', () => {
    const html = render({ title: '회의', startAt: '2030-11-12T05:00:00.000Z', endAt: '2030-11-12T06:00:00.000Z', allDay: 'false', location: '회의실' });
    expect(html).toContain('14:00'); expect(html).toContain('15:00'); expect(html).toContain('한국 시간'); expect(html).toContain('회의실');
  });
  it('shows the last included day rather than an exclusive all-day end', () => {
    const html = render({ startAt: '2030-11-11T15:00:00.000Z', endAt: '2030-11-13T15:00:00.000Z', allDay: 'true' });
    expect(html).toContain('11월 12일'); expect(html).toContain('11월 13일'); expect(html).not.toContain('11월 14일'); expect(html).toContain('마지막 날 포함');
  });
  it('keeps legacy project payload labels and tolerates malformed optional details', () => {
    expect(render({ status: 'DONE', notes: '<script>test</script>' })).toContain('완료');
    expect(render({ notes: '<script>test</script>' })).not.toContain('<script>');
    expect(render('invalid json')).toBe('');
    expect(() => render({ allDay: 'true', startAt: 'broken', endAt: 'broken' })).not.toThrow();
  });
});

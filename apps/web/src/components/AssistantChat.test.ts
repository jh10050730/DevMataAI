import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Details from './AssistantActionDetails';
import { actionLabels } from './AssistantChat';
import { isPending } from '../context/AssistantChatContext';

const render = (payload: object) => renderToStaticMarkup(createElement(Details, { payload: JSON.stringify(payload) }));

describe('AI 비서 변경 제안 표시', () => {
  it('할 일 추가·수정 필드를 한국어로 보여 준다', () => {
    const html = render({ title: '보고서', priority: 'URGENT', category: 'DEV', dueDate: '2030-01-01T09:00:00.000Z', completed: 'false' });
    expect(html).toContain('우선순위'); expect(html).toContain('긴급'); expect(html).toContain('개발');
    expect(html).toContain('마감'); expect(html).toContain('18:00'); expect(html).toContain('아니오');
  });
  it('빈 마감은 "마감 지우기", 태그는 목록, 긴 본문은 줄여서', () => {
    expect(render({ dueDate: '' })).toContain('마감 지우기');
    expect(render({ tags: '["ts","언어"]' })).toContain('ts, 언어');
    const long = render({ content: 'x'.repeat(2000) });
    expect(long).toContain('2,000자'); expect(long.length).toBeLessThan(1500);
  });
  it('새 작업 종류마다 이름이 있다', () => {
    for (const kind of ['task_create', 'task_update', 'event_update', 'note_create', 'note_update']) expect(actionLabels[kind]).toBeTruthy();
  });
  it('확인 가능한 제안: 처리 전이고 만료 전', () => {
    expect(isPending({ id: '1', kind: 'task_create', targetTitle: 't', payload: '{}' })).toBe(true);
    expect(isPending({ id: '1', kind: 'task_create', targetTitle: 't', payload: '{}', state: '적용 완료' })).toBe(false);
    expect(isPending({ id: '1', kind: 'task_create', targetTitle: 't', payload: '{}', expiresAt: new Date(Date.now() - 1000).toISOString() })).toBe(false);
  });
});

import { notifyDesktop, returnPage, settingsPath } from './desktop-return';

describe('데스크톱 앱으로 돌아가기', () => {
  it('설정 화면 경로에 결과와 이유를 담는다', () => {
    expect(settingsPath('connected')).toBe('/settings?google=connected');
    expect(settingsPath('error', '취소 & 다시')).toBe('/settings?google=error&reason=%EC%B7%A8%EC%86%8C%20%26%20%EB%8B%A4%EC%8B%9C');
  });

  it('IPC 가 있으면 앱에 창 열기를 요청하고, 없거나 실패하면 false', () => {
    const sent: unknown[] = [];
    expect(notifyDesktop('/settings?google=connected', m => { sent.push(m); return true; })).toBe(true);
    expect(sent).toEqual([{ type: 'open-app', path: '/settings?google=connected' }]);
    expect(notifyDesktop('/x', null)).toBe(false);
    expect(notifyDesktop('/x', () => { throw new Error('closed'); })).toBe(false);
  });

  it('결과 페이지: 성공 안내, 실패 이유는 HTML 이스케이프', () => {
    expect(returnPage(true)).toContain('연결 완료');
    const fail = returnPage(false, '<script>alert(1)</script>');
    expect(fail).toContain('연결 실패');
    expect(fail).not.toContain('<script>alert(1)</script>');
    expect(fail).toContain('&lt;script&gt;');
  });
});

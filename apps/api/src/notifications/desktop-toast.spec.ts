import { desktopToastEnabled, toastLink, toastXml } from './desktop-toast';

describe('desktop-toast', () => {
  it('제목·본문·주소의 특수문자를 XML 로 안전하게 넣는다', () => {
    const xml = toastXml('할 일 <마감> & "하루 전"', "it's\u0001 ok", 'http://localhost:5173/calendar?a=1&b=2');
    expect(xml).toContain('<text>할 일 &lt;마감&gt; &amp; &quot;하루 전&quot;</text>');
    expect(xml).toContain('<text>it&apos;s ok</text>');
    expect(xml).toContain('activationType="protocol" launch="http://localhost:5173/calendar?a=1&amp;b=2"');
  });

  it('주소가 없으면 launch 없이, 긴 글은 잘라서', () => {
    const xml = toastXml('t'.repeat(500), 'b'.repeat(500));
    expect(xml.startsWith('<toast><visual>')).toBe(true);
    expect(xml).toContain(`<text>${'t'.repeat(120)}</text>`);
    expect(xml).toContain(`<text>${'b'.repeat(300)}</text>`);
  });

  it('Windows 에서만, 테스트·끄기 설정에서는 비활성', () => {
    expect(desktopToastEnabled({}, 'win32')).toBe(true);
    expect(desktopToastEnabled({}, 'linux')).toBe(false);
    expect(desktopToastEnabled({ NODE_ENV: 'test' }, 'win32')).toBe(false);
    expect(desktopToastEnabled({ DESKTOP_NOTIFICATIONS: 'false' }, 'win32')).toBe(false);
  });

  it('데스크톱 앱에서는 알림을 누르면 앱 창으로, 웹 서버에서는 브라우저 주소로 연다', () => {
    const web = () => 'http://localhost:3000/calendar';
    expect(toastLink('/calendar?view=week', web, { DEVMATA_DESKTOP: '1' })).toBe('devmata://open?path=%2Fcalendar%3Fview%3Dweek');
    expect(toastLink('calendar', web, { DEVMATA_DESKTOP: '1' })).toBe('devmata://open?path=%2Fcalendar');
    expect(toastLink('/calendar', web, {})).toBe('http://localhost:3000/calendar');
    expect(toastLink('/', () => { throw new Error('주소 없음'); }, {})).toBeUndefined();
  });
});

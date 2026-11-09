import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { articleAddress, extractArticleText, isPublicAddress, readArticle } from './news.reader';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('node:https', () => ({ request: jest.fn() }));

const text = '지역 경제의 새 보고서는 고용과 물가 변화를 분석했습니다. 기업들은 생산 계획을 공개했고 연구진은 다음 분기에 추가 자료를 발표할 예정입니다. '.repeat(12);
const html = `<html><head><title>경제 보고서</title><script>malicious()</script></head><body><nav>unrelated navigation</nav><article><h1>경제 보고서</h1><p>${text}</p></article><footer>unrelated footer</footer></body></html>`;

describe('news original article reader', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (lookup as jest.Mock).mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
  });
  function respond(body: string, statusCode = 200, headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' }) {
    (request as unknown as jest.Mock).mockImplementationOnce((_url, _options, callback) => {
      const req = new EventEmitter() as EventEmitter & { end(): void };
      req.end = () => callback(Object.assign(Readable.from([Buffer.from(body)]), { statusCode, headers }));
      return req;
    });
  }
  it.each(['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.1.1', '100.64.0.1', '::1', 'fc00::1', '::ffff:127.0.0.1', '2001:db8::1'])('blocks non-public address %s', address => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it('extracts body text without scripts and navigation', () => {
    const body = extractArticleText(html);
    expect(body).toContain('고용과 물가');
    expect(body).not.toMatch(/malicious|unrelated/);
  });
  it('rejects paywalls and challenge pages', () => {
    expect(() => extractArticleText(html.replace('</head>', '<script type="application/ld+json">{"isAccessibleForFree":false}</script></head>'))).toThrow();
    expect(() => extractArticleText(html.replace('경제 보고서</title>', 'Just a moment</title>'))).toThrow();
    expect(() => extractArticleText('<html><body>로그인이 필요합니다</body></html>')).toThrow();
  });
  it('pins the validated public DNS address for the actual request', async () => {
    respond(html);
    expect(await readArticle('https://publisher.example/article')).toMatchObject({ available: true, url: 'https://publisher.example/article' });
    const options = (request as unknown as jest.Mock).mock.calls[0][1];
    const callback = jest.fn();
    options.lookup('publisher.example', {}, callback);
    expect(callback).toHaveBeenCalledWith(null, '8.8.8.8', 4);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
  it('rejects mixed public and private DNS records before making a request', async () => {
    (lookup as jest.Mock).mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]);
    expect(await readArticle('https://publisher.example/article')).toMatchObject({ available: false });
    expect(request).not.toHaveBeenCalled();
  });
  it('revalidates a redirect and blocks a private destination', async () => {
    respond('', 302, { location: 'http://169.254.169.254/latest' });
    expect(await readArticle('https://publisher.example/article')).toMatchObject({ available: false });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(['file:///etc/passwd', 'https://user:pass@publisher.example/', 'https://publisher.example:8443/', 'http://localhost/'])('rejects unsupported URL %s', async url => {
    await expect(articleAddress(new URL(url), AbortSignal.timeout(1000))).rejects.toThrow();
    expect(lookup).not.toHaveBeenCalled();
  });
  it('rejects non-HTML and oversized bodies', async () => {
    respond('pdf', 200, { 'content-type': 'application/pdf' });
    expect(await readArticle('https://publisher.example/pdf')).toMatchObject({ available: false });
    respond('x'.repeat(2 * 1024 * 1024 + 1));
    expect(await readArticle('https://publisher.example/large')).toMatchObject({ available: false });
  });
  it('aborts unresolved DNS at the deadline', async () => {
    (lookup as jest.Mock).mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    const pending = articleAddress(new URL('https://publisher.example/article'), controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow('timeout');
  });
});

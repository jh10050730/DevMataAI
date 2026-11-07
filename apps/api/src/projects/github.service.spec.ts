import { ConfigService } from '@nestjs/config';
import { GithubService } from './github.service';
describe('GitHub activity', () => {
  afterEach(() => jest.restoreAllMocks());
  it('PR을 이슈에서 제외하고 부분 실패와 조회 상한을 표시', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async input => {
      const url = String(input);
      if (url.includes('/commits?')) return new Response('', { status: 403 });
      if (url.includes('/issues?')) return new Response(JSON.stringify([{ number: 1, title: 'issue', html_url: 'https://github.com/a/b/issues/1' }, { number: 2, pull_request: {}, html_url: 'https://github.com/a/b/pull/2' }]), { headers: { link: '<https://api.github.com/next>; rel="next"' } });
      return new Response(JSON.stringify([{ number: 3, title: 'old PR', html_url: 'https://github.com/a/b/pull/3', updated_at: '2020-01-01' }]));
    });
    const result = await new GithubService(new ConfigService()).activity('a/b');
    expect(result.connected).toBe(true);
    expect(result.sections[0].ok).toBe(false);
    expect(result.sections[1].items).toHaveLength(1);
    expect(result.sections[1].truncated).toBe(true);
    expect(result.sections[2].items).toHaveLength(0);
  });
  it('토큰 없이 공개 조회하며 미설정 저장소는 호출하지 않음', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('[]'));
    const service = new GithubService(new ConfigService());
    expect((await service.activity('')).connected).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    await service.activity('a/b');
    expect(fetch.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');
  });
});

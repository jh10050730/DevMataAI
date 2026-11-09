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
describe('GitHub files (읽기 전용)', () => {
  afterEach(() => jest.restoreAllMocks());
  it('기본 브랜치 트리에서 비밀·의존성 파일을 빼고, 파일 내용은 raw로 읽음', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/repos/a/b')) return new Response(JSON.stringify({ default_branch: 'main' }));
      if (url.includes('/git/trees/main?recursive=1')) return new Response(JSON.stringify({ truncated: false, tree: [
        { path: 'README.md', type: 'blob', size: 10 }, { path: 'src', type: 'tree' }, { path: 'src/a.ts', type: 'blob', size: 5 },
        { path: '.env', type: 'blob', size: 3 }, { path: 'node_modules/x.js', type: 'blob', size: 1 },
      ] }));
      if (url.includes('/contents/src/a.ts')) return new Response('const a = 1;');
      return new Response('', { status: 404 });
    });
    const service = new GithubService(new ConfigService());
    const list = await service.files('a/b');
    expect(list.branch).toBe('main');
    expect(list.files.map(f => f.path)).toEqual(['README.md', 'src/a.ts']);
    expect(await service.read('a/b', 'src/a.ts')).toBe('const a = 1;');
    expect(fetch.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
    await expect(service.read('a/b', '.env')).rejects.toThrow('읽을 수 없는 경로');
    await expect(service.read('a/b', 'missing.md')).rejects.toThrow('찾을 수 없');
  });
});

import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAX_LIST, MAX_READ, isAllowedPath } from './project-files';
import type { Commit } from './devlog.logic';
type Row = { sha?: string; number?: number; title?: string; state?: string; html_url: string; updated_at?: string; pull_request?: unknown; commit?: { message: string; author?: { date?: string } } };
@Injectable()
export class GithubService {
  constructor(private readonly config: ConfigService) {}
  async activity(repository: string) {
    if (!repository) return { connected: false, message: 'owner/repository 형식으로 저장소를 등록하세요.', sections: [] };
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'DevMataAI' };
    const token = this.config.get<string>('GITHUB_TOKEN');
    if (token) headers.Authorization = `Bearer ${token}`;
    const base = `https://api.github.com/repos/${repository.split('/').map(encodeURIComponent).join('/')}`;
    const specs = [
      { kind: 'commits', path: `/commits?since=${encodeURIComponent(since)}&per_page=100` },
      { kind: 'issues', path: `/issues?state=all&sort=updated&since=${encodeURIComponent(since)}&per_page=100` },
      { kind: 'pulls', path: '/pulls?state=all&sort=updated&direction=desc&per_page=100' },
    ];
    const sections = await Promise.all(specs.map(async spec => {
      try {
        const res = await fetch(base + spec.path, { headers, signal: AbortSignal.timeout(15000), redirect: 'error' });
        if (!res.ok) return { kind: spec.kind, ok: false, message: res.status === 404 ? '저장소를 찾을 수 없거나 접근 권한이 없습니다.' : 'GitHub 권한 또는 호출 한도를 확인하세요.', items: [], truncated: false };
        const rows = await res.json() as Row[];
        const items = rows.filter(r => spec.kind !== 'issues' || !r.pull_request).filter(r => spec.kind !== 'pulls' || (r.updated_at ?? '') >= since).map(r => ({ id: r.sha ?? String(r.number), title: (r.commit?.message ?? r.title ?? '').slice(0, 1000), url: r.html_url, state: r.state, date: r.commit?.author?.date ?? r.updated_at }));
        return { kind: spec.kind, ok: true, items, truncated: !!res.headers.get('link')?.includes('rel="next"') };
      } catch { return { kind: spec.kind, ok: false, message: 'GitHub에 연결하지 못했습니다.', items: [], truncated: false }; }
    }));
    return { connected: sections.some(s => s.ok), repository, url: `https://github.com/${repository}`, since, until: new Date().toISOString(), authenticated: !!token, message: '최근 7일 기본 브랜치 커밋과 업데이트된 이슈·PR입니다. 각 항목은 최대 100개이며 커밋 수는 진행률에 반영하지 않습니다.', sections };
  }

  private headers(accept = 'application/vnd.github+json') {
    const headers: Record<string, string> = { Accept: accept, 'User-Agent': 'DevMataAI' };
    const token = this.config.get<string>('GITHUB_TOKEN');
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }
  private base(repository: string) { return `https://api.github.com/repos/${repository.split('/').map(encodeURIComponent).join('/')}`; }
  private async get(url: string, accept?: string) {
    let res: Response;
    try { res = await fetch(url, { headers: this.headers(accept), signal: AbortSignal.timeout(15000), redirect: 'error' }); }
    catch { throw new BadGatewayException('GitHub에 연결하지 못했습니다.'); }
    if (res.status === 404) throw new NotFoundException('저장소나 파일을 찾을 수 없거나 접근 권한이 없습니다. 비공개 저장소는 GITHUB_TOKEN이 필요합니다.');
    if (!res.ok) throw new BadGatewayException('GitHub 권한 또는 호출 한도를 확인하세요.');
    return res;
  }

  /** 기본 브랜치에서 [since, until) 사이 커밋 (개발일지용, 최대 100개). 파일 목록은 PC 폴더 쪽에서 채운다 */
  async commits(repository: string, since: Date, until: Date): Promise<Commit[]> {
    const res = await this.get(`${this.base(repository)}/commits?since=${encodeURIComponent(since.toISOString())}&until=${encodeURIComponent(until.toISOString())}&per_page=100`);
    const rows = await res.json() as { sha: string; html_url: string; commit: { message: string; author?: { name?: string; date?: string } } }[];
    return rows.map(r => {
      const [title = '', ...rest] = r.commit.message.split('\n');
      return { sha: r.sha, title: title.slice(0, 300), body: rest.join('\n').trim().slice(0, 1000), date: r.commit.author?.date ?? '', author: r.commit.author?.name ?? '', files: [], source: 'github' as const, url: r.html_url };
    });
  }

  /** 기본 브랜치의 전체 파일 목록 (읽기 전용). */
  async files(repository: string, limit = MAX_LIST) {
    const repo = await (await this.get(this.base(repository))).json() as { default_branch: string };
    const tree = await (await this.get(`${this.base(repository)}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`)).json() as { tree: { path: string; type: string; size?: number }[]; truncated: boolean };
    const all = tree.tree.filter(t => t.type === 'blob' && isAllowedPath(t.path)).map(t => ({ path: t.path, size: t.size ?? 0 }));
    return { branch: repo.default_branch, files: all.slice(0, limit), truncated: tree.truncated || all.length > limit };
  }

  /** 기본 브랜치의 텍스트 파일 하나 (읽기 전용). */
  async read(repository: string, path: string, max = MAX_READ) {
    if (!isAllowedPath(path)) throw new BadRequestException('읽을 수 없는 경로입니다.');
    const res = await this.get(`${this.base(repository)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, 'application/vnd.github.raw+json');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > max) throw new BadRequestException(`파일이 너무 큽니다 (최대 ${Math.round(max / 1000)}KB).`);
    if (buf.subarray(0, 8000).includes(0)) throw new BadRequestException('텍스트 파일만 읽을 수 있습니다.');
    return buf.toString('utf8');
  }
}

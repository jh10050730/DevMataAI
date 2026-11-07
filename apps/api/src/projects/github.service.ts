import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
type Row = { sha?: string; number?: number; title?: string; state?: string; html_url: string; updated_at?: string; pull_request?: unknown; commit?: { message: string; author?: { date?: string } } };
@Injectable()
export class GithubService {
  constructor(private readonly config: ConfigService) {}
  async activity(repository: string) {
    if (!repository) return { connected: false, message: 'owner/repository 형식으로 저장소를 등록하세요.', sections: [] };
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'DevMateAI' };
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
}

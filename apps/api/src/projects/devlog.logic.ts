import { spawn } from 'node:child_process';

/** 개발일지에 쓰는 커밋 하나 */
export type Commit = { sha: string; title: string; body: string; date: string; author: string; files: string[]; source: 'local' | 'github'; url?: string };

/** 하루에 모으는 커밋 상한 (AI에 보내는 양도 이만큼으로 제한) */
export const MAX_COMMITS = 150;
const FILES_PER_COMMIT = 20;

/** YYYY-MM-DD (한국 시간) 하루의 시작·끝 */
export function dayRange(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(+new Date(`${day}T00:00:00+09:00`))) throw new Error('날짜 형식이 올바르지 않습니다.');
  const since = new Date(`${day}T00:00:00+09:00`);
  return { since, until: new Date(since.getTime() + 86_400_000) };
}

/** git log 출력(아래 GIT_FORMAT + --name-only)을 커밋 목록으로 */
export const GIT_FORMAT = '--pretty=format:%x1e%H%x1f%an%x1f%aI%x1f%s%x1f%b%x1f';
export function parseGitLog(stdout: string): Commit[] {
  return stdout.split('\x1e').filter(r => r.trim()).map(record => {
    const [sha, author, date, title, body, rest = ''] = record.split('\x1f');
    const files = rest.split(/\r?\n/).map(f => f.trim()).filter(Boolean).slice(0, FILES_PER_COMMIT);
    return { sha: sha.trim(), author: author ?? '', date: date ?? '', title: (title ?? '').trim(), body: (body ?? '').trim().slice(0, 1000), files, source: 'local' as const };
  }).filter(c => /^[0-9a-f]{7,64}$/i.test(c.sha));
}

/**
 * PC 폴더(git 저장소)에서 [since, until) 사이 커밋을 읽는다. 모든 브랜치, 병합 커밋 제외.
 * 셸 없이 git 을 실행하고, 시간이 오래 걸리면 끊는다. git 이 없거나 저장소가 아니면 오류.
 */
export function localCommits(root: string, since: Date, until: Date, run = runGit): Promise<Commit[]> {
  return run(['-C', root, 'log', '--all', '--no-merges', `--since=${since.toISOString()}`, `--until=${until.toISOString()}`, '-n', String(MAX_COMMITS), '--name-only', GIT_FORMAT])
    .then(out => parseGitLog(out).filter(c => { const t = +new Date(c.date); return t >= +since && t < +until; }));
}

function runGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = '';
    let err = '';
    const child = spawn('git', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C.UTF-8' } });
    const timer = setTimeout(() => child.kill(), 15_000);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { if (out.length < 2_000_000) out += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { err += chunk; });
    child.on('error', () => { clearTimeout(timer); reject(new Error('git 을 실행하지 못했어요. Git이 설치되어 있는지 확인해 주세요.')); });
    child.on('close', code => { clearTimeout(timer); if (code === 0) resolve(out); else reject(new Error(/not a git repository/i.test(err) ? 'PC 폴더가 git 저장소가 아니에요.' : 'git 기록을 읽지 못했어요.')); });
  });
}

/** 같은 커밋이 PC 폴더와 GitHub 양쪽에 있으면 하나만 (파일 목록이 있는 PC 쪽 우선), 시간순 */
export function mergeCommits(...lists: Commit[][]) {
  const bySha = new Map<string, Commit>();
  for (const list of lists) for (const c of list) {
    const key = c.sha.toLowerCase();
    const prev = bySha.get(key);
    bySha.set(key, prev ? { ...prev, url: prev.url ?? c.url, files: prev.files.length ? prev.files : c.files } : c);
  }
  return [...bySha.values()].sort((a, b) => +new Date(a.date) - +new Date(b.date)).slice(0, MAX_COMMITS);
}

/** AI 없이 만드는 개발일지: 커밋 제목 목록 */
export function fallbackDevLog(commits: Commit[]) {
  const time = (d: string) => new Date(d).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return ['## 한 일', ...commits.map(c => `- ${time(c.date)} ${c.title || '(제목 없음)'}`), '', '_AI 없이 커밋 제목으로 만든 일지예요. AI 계정을 연결하면 정리된 일지를 만들 수 있어요._'].join('\n');
}

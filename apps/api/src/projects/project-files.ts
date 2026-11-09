import { BadRequestException } from '@nestjs/common';
import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, parse, relative, resolve, sep } from 'node:path';

/** 목록에서 건너뛰는 폴더 (빌드 결과물·의존성·VCS) */
export const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out', '.next', '.nuxt', '.turbo', '.cache', 'coverage', '.venv', 'venv', '__pycache__', '.idea', '.vs', '.vscode', 'target', 'bin', 'obj', '.gradle', 'vendor', 'backups']);
/** 읽지 않는 비밀·인증 파일 */
const SECRET = [/^\.env(?!\.(example|sample|template)$)/i, /\.(pem|key|p12|pfx|keystore|jks|crt|cer)$/i, /^id_(rsa|dsa|ecdsa|ed25519)/i, /^\.(npmrc|pypirc|netrc|git-credentials)$/i, /credentials?\.json$/i, /^secrets?\./i, /\.(sqlite|db)$/i];

export const MAX_LIST = 2000;
export const MAX_READ = 100_000;

export type FileEntry = { path: string; size: number };

/** 경로의 모든 구간이 허용되는지 확인 (건너뛰는 폴더·비밀 파일 차단) */
export function isAllowedPath(rel: string) {
  const parts = rel.split(/[\\/]/).filter(Boolean);
  if (!parts.length || parts.some(p => p === '..' || p === '.')) return false;
  if (parts.slice(0, -1).some(p => SKIP_DIRS.has(p))) return false;
  return !SECRET.some(re => re.test(parts[parts.length - 1]));
}

/** 프로젝트 폴더로 등록할 경로 검증: 절대 경로, 존재하는 폴더, 드라이브 루트 금지. 정규화된 실제 경로를 돌려준다. */
export async function validateRoot(input: string) {
  const value = input.trim();
  if (!value) return '';
  if (!isAbsolute(value)) throw new BadRequestException('폴더는 C:\\... 같은 전체 경로로 입력하세요.');
  let real: string;
  try {
    real = await realpath(resolve(value));
    if (!(await stat(real)).isDirectory()) throw new Error();
  } catch {
    throw new BadRequestException('폴더를 찾을 수 없습니다. 경로를 확인하세요.');
  }
  if (parse(real).root === real) throw new BadRequestException('드라이브 전체는 등록할 수 없습니다. 프로젝트 폴더를 지정하세요.');
  return real;
}

/** 폴더 안의 파일 목록 (상대 경로, / 구분). 심볼릭 링크는 따라가지 않는다. */
export async function listLocal(root: string, limit = MAX_LIST) {
  const files: FileEntry[] = [];
  let truncated = false;
  const queue: [string, number][] = [['', 0]];
  while (queue.length) {
    const [dir, depth] = queue.shift()!;
    let entries;
    try { entries = await readdir(join(root, dir), { withFileTypes: true }); } catch { continue; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && depth < 8) queue.push([rel, depth + 1]); continue; }
      if (!e.isFile() || !isAllowedPath(rel)) continue;
      if (files.length >= limit) { truncated = true; break; }
      try { files.push({ path: rel, size: (await lstat(join(root, rel))).size }); } catch { /* 사라진 파일 무시 */ }
    }
    if (truncated) break;
  }
  return { files, truncated };
}

/** 폴더 안의 텍스트 파일 하나를 읽는다. 폴더 밖·비밀·바이너리·큰 파일은 거부. */
export async function readLocal(root: string, rel: string, max = MAX_READ) {
  if (!isAllowedPath(rel)) throw new BadRequestException('읽을 수 없는 경로입니다.');
  const rootReal = await realpath(root);
  let target: string;
  try { target = await realpath(join(rootReal, rel)); } catch { throw new BadRequestException('파일을 찾을 수 없습니다.'); }
  const within = relative(rootReal, target);
  if (!within || within.startsWith('..') || isAbsolute(within) || within.split(sep).includes('..')) throw new BadRequestException('프로젝트 폴더 밖의 파일은 읽을 수 없습니다.');
  const info = await stat(target);
  if (!info.isFile()) throw new BadRequestException('파일이 아닙니다.');
  if (info.size > max) throw new BadRequestException(`파일이 너무 큽니다 (최대 ${Math.round(max / 1000)}KB).`);
  const buf = await readFile(target);
  if (buf.subarray(0, 8000).includes(0)) throw new BadRequestException('텍스트 파일만 읽을 수 있습니다.');
  return buf.toString('utf8');
}

/** 진행률 판단에 도움이 되는 파일을 우선순위대로 고른다 (문서·설정 → 얕은 경로). */
export function pickKeyFiles(files: FileEntry[], limit = 8) {
  const score = (f: FileEntry) => {
    const name = f.path.split('/').pop()!.toLowerCase();
    const depth = f.path.split('/').length - 1;
    if (f.size > MAX_READ || f.size === 0) return -1;
    let s = 0;
    if (/^readme(\.|$)/.test(name)) s += 100;
    if (/(roadmap|todo|plan|progress|changelog|handoff|spec|requirements?)(\.|$)/.test(name) && /\.(md|txt)$/.test(name)) s += 80;
    if (['package.json', 'pyproject.toml', 'cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'requirements.txt'].includes(name)) s += 60;
    if (/\.(md|txt)$/.test(name)) s += 20;
    if (name.includes('lock') || name.endsWith('.min.js')) return -1;
    return s ? s - depth * 10 : -1;
  };
  return files.map(f => ({ f, s: score(f) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit).map(x => x.f);
}

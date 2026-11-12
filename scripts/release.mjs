// 새 버전 만들기: 모든 package.json 과 package-lock.json 의 버전을 올리고, 그 파일만 커밋한 뒤 v<버전> 태그를 단다.
// 사용: npm run release -- patch | minor | major | 1.2.3   [--push]
//   --push 를 붙이면 main 과 태그를 GitHub 에 올린다 → GitHub Actions 가 설치 파일을 만들어 Releases 에 올린다.
// 다른 파일의 커밋 안 된 변경은 건드리지 않는다 (함께 작업 중인 변경이 섞이지 않게).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from './db-tools.mjs';

export const MANIFESTS = ['package.json', 'apps/api/package.json', 'apps/web/package.json', 'apps/desktop/package.json'];
export const LOCK = 'package-lock.json';
const LOCK_KEYS = ['', 'apps/api', 'apps/web', 'apps/desktop'];

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseVersion(text) {
  const m = SEMVER.exec(String(text).trim());
  if (!m) throw new Error(`버전 형식이 아닙니다 (예: 1.2.3): ${text}`);
  return m.slice(1).map(Number);
}

const greater = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** 앱에 처음 들어올 때 보여 주는 업데이트 안내 (큰 업데이트: 앞의 두 자리가 바뀔 때만) */
export const RELEASE_NOTES = 'apps/web/src/releaseNotes.json';

/** 큰 업데이트인데 안내 글이 없으면 그 키("0.3")를, 아니면 null 을 돌려준다 */
export function missingReleaseNote(current, next, notes) {
  const [cm, cn] = parseVersion(current), [nm, nn] = parseVersion(next);
  if (cm === nm && cn === nn) return null;
  const key = `${nm}.${nn}`;
  const note = notes?.[key];
  return note && typeof note.title === 'string' && note.title.trim() && Array.isArray(note.items) && note.items.length ? null : key;
}

/** 지금 버전과 요청(patch·minor·major·x.y.z)으로 다음 버전을 정한다. 지금보다 커야 한다 */
export function nextVersion(current, request) {
  const [major, minor, patch] = parseVersion(current);
  const next = request === 'patch' ? [major, minor, patch + 1]
    : request === 'minor' ? [major, minor + 1, 0]
    : request === 'major' ? [major + 1, 0, 0]
    : parseVersion(request);
  if (greater(next, [major, minor, patch]) <= 0) throw new Error(`새 버전(${next.join('.')})은 지금 버전(${current})보다 커야 합니다.`);
  return next.join('.');
}

/** JSON 텍스트의 "version" 만 바꾼다 (들여쓰기·줄바꿈 유지) */
export function setManifestVersion(text, version) {
  const json = JSON.parse(text);
  json.version = version;
  return format(json, text);
}

/** package-lock.json 의 루트와 앱 워크스페이스 버전만 바꾼다 */
export function setLockVersion(text, version) {
  const lock = JSON.parse(text);
  lock.version = version;
  for (const key of LOCK_KEYS) if (lock.packages?.[key]) lock.packages[key].version = version;
  return format(lock, text);
}

function format(json, original) {
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const out = JSON.stringify(json, null, 2) + '\n';
  return eol === '\n' ? out : out.replace(/\n/g, eol);
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

function main() {
  const args = process.argv.slice(2);
  const push = args.includes('--push');
  const request = args.find(a => !a.startsWith('--'));
  if (!request) throw new Error('사용: npm run release -- patch | minor | major | 1.2.3 [--push]');

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== 'main') throw new Error(`main 브랜치에서만 릴리스합니다 (지금: ${branch}).`);
  const files = [...MANIFESTS, LOCK];
  const dirty = git('status', '--porcelain', '--', ...files);
  if (dirty) throw new Error(`버전 파일에 커밋 안 된 변경이 있습니다. 먼저 정리하세요:\n${dirty}`);

  const current = JSON.parse(readFileSync(join(root, 'apps/desktop/package.json'), 'utf8')).version;
  const version = nextVersion(current, request);
  const tag = `v${version}`;
  if (git('tag', '--list', tag)) throw new Error(`태그 ${tag} 가 이미 있습니다.`);
  const notes = JSON.parse(readFileSync(join(root, RELEASE_NOTES), 'utf8'));
  const missing = missingReleaseNote(current, version, notes);
  if (missing) throw new Error(`큰 업데이트(${missing})입니다. 앱에 처음 들어올 때 보여 줄 새로워진 점을 ${RELEASE_NOTES} 의 "${missing}" 에 먼저 적고 커밋하세요.`);

  for (const file of MANIFESTS) writeFileSync(join(root, file), setManifestVersion(readFileSync(join(root, file), 'utf8'), version));
  writeFileSync(join(root, LOCK), setLockVersion(readFileSync(join(root, LOCK), 'utf8'), version));

  git('add', '--', ...files);
  git('commit', '-m', `버전 ${version}`, '--', ...files);
  git('tag', '-a', tag, '-m', `DevMata AI ${version}`);
  console.log(`버전 ${current} → ${version}, 태그 ${tag} 를 만들었습니다.`);

  if (push) {
    git('push', 'origin', 'main');
    git('push', 'origin', tag);
    console.log('GitHub 에 올렸습니다. Actions 에서 설치 파일이 만들어지면 Releases 에 올라갑니다.');
  } else {
    console.log(`GitHub 에 올리려면: git push origin main && git push origin ${tag}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exit(1); }
}

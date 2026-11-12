import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { root } from './db-tools.mjs';
import { LOCK, MANIFESTS, RELEASE_NOTES, missingReleaseNote, nextVersion, parseVersion, setLockVersion, setManifestVersion } from './release.mjs';

test('큰 업데이트(앞의 두 자리)는 안내 글이 있어야 배포, 작은 업데이트는 없어도 됨', () => {
  const notes = { '0.3': { title: '0.3', items: ['새 기능'] }, '1.0': { title: '', items: ['x'] } };
  assert.equal(missingReleaseNote('0.3.0', '0.3.1', {}), null);
  assert.equal(missingReleaseNote('0.2.4', '0.3.0', notes), null);
  assert.equal(missingReleaseNote('0.3.0', '0.4.0', notes), '0.4');
  assert.equal(missingReleaseNote('0.9.0', '1.0.0', notes), '1.0');
  const real = JSON.parse(readFileSync(join(root, RELEASE_NOTES), 'utf8'));
  assert.ok(Object.keys(real).length > 0);
});

test('다음 버전: patch·minor·major·직접 지정, 지금보다 커야 함', () => {
  assert.equal(nextVersion('0.1.0', 'patch'), '0.1.1');
  assert.equal(nextVersion('0.1.9', 'minor'), '0.2.0');
  assert.equal(nextVersion('0.9.3', 'major'), '1.0.0');
  assert.equal(nextVersion('0.1.0', '0.10.0'), '0.10.0');
  assert.throws(() => nextVersion('0.2.0', '0.1.9'), /커야/);
  assert.throws(() => nextVersion('0.2.0', '0.2.0'), /커야/);
  assert.throws(() => parseVersion('v1.2'), /형식/);
  assert.throws(() => parseVersion('1.2.3-beta'), /형식/);
});

test('package.json 은 version 만 바뀌고 줄바꿈 방식은 그대로', () => {
  const crlf = '{\r\n  "name": "x",\r\n  "version": "0.1.0",\r\n  "private": true\r\n}\r\n';
  assert.equal(setManifestVersion(crlf, '0.2.0'), crlf.replace('0.1.0', '0.2.0'));
  const lf = '{\n  "name": "x",\n  "version": "0.1.0"\n}\n';
  assert.equal(setManifestVersion(lf, '1.0.0'), lf.replace('0.1.0', '1.0.0'));
});

test('package-lock.json 은 루트와 앱 워크스페이스 버전만 바뀐다', () => {
  const lock = JSON.stringify({ name: 'devmate-ai', version: '0.1.0', lockfileVersion: 3, packages: {
    '': { name: 'devmate-ai', version: '0.1.0' },
    'apps/api': { name: '@devmate/api', version: '0.1.0' },
    'apps/web': { name: '@devmate/web', version: '0.1.0' },
    'apps/desktop': { name: '@devmate/desktop', version: '0.1.0' },
    'node_modules/foo': { version: '0.1.0' },
  } }, null, 2) + '\n';
  const out = JSON.parse(setLockVersion(lock, '0.2.0'));
  assert.equal(out.version, '0.2.0');
  for (const key of ['', 'apps/api', 'apps/web', 'apps/desktop']) assert.equal(out.packages[key].version, '0.2.0');
  assert.equal(out.packages['node_modules/foo'].version, '0.1.0');
});

test('지금 저장소의 모든 버전이 서로 같다 (화면 버전 = 설치 파일 버전)', () => {
  const versions = MANIFESTS.map(f => JSON.parse(readFileSync(join(root, f), 'utf8')).version);
  const lock = JSON.parse(readFileSync(join(root, LOCK), 'utf8'));
  versions.push(lock.version, ...['', 'apps/api', 'apps/web', 'apps/desktop'].map(k => lock.packages[k].version));
  assert.equal(new Set(versions).size, 1, `버전이 다릅니다: ${versions.join(', ')}`);
});

// SQLite DB 파일 위치와 백업 도구 (Node 22.13+ 내장 node:sqlite 사용, 별도 DB 서버 불필요)
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prismaDir = join(root, 'apps/api/prisma');

/** apps/api/.env(또는 환경변수)의 DATABASE_URL → DB 파일 절대 경로. 상대 경로는 Prisma 와 같이 apps/api/prisma 기준 */
export function databaseFile(env = process.env) {
  let raw = env.DATABASE_URL;
  const envFile = join(root, 'apps/api/.env');
  if (!raw && existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8').split(/\r?\n/).find(l => /^\s*DATABASE_URL\s*=/.test(l));
    raw = line?.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return fileFromUrl(raw);
}

export function fileFromUrl(raw, base = prismaDir) {
  if (!raw || !raw.startsWith('file:')) throw new Error('DATABASE_URL 이 SQLite 파일 주소(file:...)가 아닙니다.');
  const path = raw.slice('file:'.length).split('?')[0];
  if (!path) throw new Error('DATABASE_URL 에 파일 경로가 없습니다.');
  return isAbsolute(path) ? path : resolve(base, path);
}

/** SQL 문자열 리터럴 (작은따옴표 이스케이프) */
export const sqlString = value => `'${String(value).replace(/'/g, "''")}'`;

/** 백업 파일 이름: devmata-YYYYMMDD-HHMMSS.db (현지 시각) */
export function backupName(date = new Date()) {
  const stamp = date.toLocaleString('sv-SE').replace(/[-: ]/g, '').replace(/^(\d{8})(\d{6}).*$/, '$1-$2');
  return `devmata-${stamp}.db`;
}

export async function openDatabase(file, options = {}) {
  const { DatabaseSync } = await import('node:sqlite');
  return new DatabaseSync(file, options);
}

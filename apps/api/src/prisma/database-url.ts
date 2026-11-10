import { isAbsolute, resolve } from 'node:path';

/** apps/api/prisma (src/prisma 와 dist/prisma 어느 쪽에서 실행해도 같은 위치) */
export const PRISMA_DIR = resolve(__dirname, '..', '..', 'prisma');

/**
 * SQLite 주소를 절대 경로로 바꾼다.
 * Prisma CLI는 `file:` 상대 경로를 schema.prisma 폴더 기준으로 해석하므로, 실행 중인 서버도 같은 기준을 쓰게 맞춘다.
 * (데스크톱 앱은 처음부터 절대 경로를 넘긴다.)
 */
export function resolveDatabaseUrl(url: string | undefined, base = PRISMA_DIR): string {
  if (!url) throw new Error('DATABASE_URL 이 필요합니다.');
  if (!url.startsWith('file:')) throw new Error('DATABASE_URL 은 SQLite 파일 주소(file:...)여야 합니다.');
  const [rawPath, query] = url.slice('file:'.length).split(/\?(.*)/s, 2);
  if (!rawPath) throw new Error('DATABASE_URL 에 DB 파일 경로가 없습니다.');
  const file = isAbsolute(rawPath) ? rawPath : resolve(base, rawPath);
  // Prisma 는 Windows 에서도 / 구분자를 안정적으로 처리한다.
  return `file:${file.replace(/\\/g, '/')}${query ? `?${query}` : ''}`;
}

/** file:C:\...\x.db?y → C:\...\x.db */
export function databaseFile(url: string): string {
  return resolveDatabaseUrl(url).slice('file:'.length).split('?')[0];
}

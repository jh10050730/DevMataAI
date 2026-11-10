import * as path from 'node:path';

/**
 * 테스트 전용 SQLite 파일 (apps/api/.test/devmata-test.db).
 * 개발 DB와 다른 파일이며, 테스트 시작 때마다 지우고 마이그레이션으로 다시 만든다.
 * TEST_DATABASE_URL 로 바꿀 수 있지만 파일 이름은 -test.db 로 끝나야 한다.
 */
export const TEST_DB_FILE = path.resolve(__dirname, '..', '.test', 'devmata-test.db');

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL || `file:${TEST_DB_FILE}`;
  assertTestDbUrl(url);
  return url;
}

export function testDatabaseFile(url: string): string {
  return url.slice('file:'.length).split('?')[0];
}

/** 이름이 -test.db 로 끝나는 SQLite 파일만 초기화 대상으로 허용한다. */
export function assertTestDbUrl(url: string) {
  if (!url.startsWith('file:') || !path.isAbsolute(testDatabaseFile(url)) || !/-test\.db$/.test(testDatabaseFile(url))) {
    throw new Error(`테스트 DB는 이름이 -test.db 로 끝나는 절대 경로 SQLite 파일이어야 합니다: ${url}`);
  }
}

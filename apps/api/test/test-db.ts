import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * 테스트용 MySQL 주소.
 * TEST_DATABASE_URL 이 있으면 그 값을, 없으면 apps/api/.env 의 DATABASE_URL 에서 DB 이름 뒤에 `_test` 를 붙여 사용한다.
 * (예: .../devmate → .../devmate_test). 개발 DB는 절대 사용하지 않는다.
 */
export function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  const base = explicit || readEnvFile().DATABASE_URL;
  if (!base) throw new Error('테스트 DB 주소가 없습니다. apps/api/.env 의 DATABASE_URL 또는 TEST_DATABASE_URL 을 설정하세요.');
  const url = new URL(base);
  if (url.protocol !== 'mysql:') throw new Error('테스트 DB는 MySQL 이어야 합니다.');
  const name = url.pathname.replace(/^\//, '');
  if (!name) throw new Error('DATABASE_URL 에 DB 이름이 없습니다.');
  if (!explicit && !name.endsWith('_test')) url.pathname = `/${name}_test`;
  assertTestDbName(url);
  return url.toString();
}

/** 테스트 DB를 만들 때 접속할 주소 (.env 의 개발 DB 주소. 이 연결로는 _test DB만 DROP/CREATE 한다) */
export function serverUrl(): string {
  const base = readEnvFile().DATABASE_URL || process.env.TEST_DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL 이 없습니다.');
  return base;
}

export function testDatabaseName(urlString: string): string {
  return new URL(urlString).pathname.replace(/^\//, '');
}

/** 이름이 `_test` 로 끝나는 DB만 초기화 대상으로 허용한다. */
export function assertTestDbName(url: URL) {
  const name = url.pathname.replace(/^\//, '');
  if (!/^[A-Za-z0-9_]+_test$/.test(name)) {
    throw new Error(`테스트 DB 이름은 영문/숫자/_ 로 이루어지고 _test 로 끝나야 합니다: ${name}`);
  }
}

function readEnvFile(): Record<string, string> {
  const file = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

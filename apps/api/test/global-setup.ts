import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { testDatabaseFile, testDatabaseUrl } from './test-db';

/**
 * 테스트 시작 전 테스트 전용 SQLite 파일을 지우고, 실제 배포와 같은 마이그레이션으로 다시 만든다.
 * 개발 DB 파일은 건드리지 않는다 (이름이 -test.db 로 끝나지 않으면 testDatabaseUrl() 이 실패한다).
 */
export default function globalSetup() {
  const root = path.resolve(__dirname, '..');
  const url = testDatabaseUrl();
  const file = testDatabaseFile(url);
  for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(file + suffix, { force: true });
  mkdirSync(path.dirname(file), { recursive: true });
  try {
    execSync('npx prisma migrate deploy --schema prisma/schema.prisma', { cwd: root, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  } catch (e) {
    const err = e as { stderr?: Buffer; stdout?: Buffer };
    throw new Error(`테스트 DB 준비 실패:\n${err.stdout ?? ''}${err.stderr ?? ''}`);
  }
}

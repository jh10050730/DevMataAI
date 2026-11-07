import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { serverUrl, testDatabaseName, testDatabaseUrl } from './test-db';

/**
 * 테스트 시작 전 테스트 전용 MySQL DB(<개발DB>_test)를 비우고 스키마를 다시 만든다.
 * 개발 DB(devmate)는 건드리지 않는다. 이름이 _test 로 끝나지 않으면 testDatabaseUrl() 이 실패한다.
 */
export default function globalSetup() {
  const root = path.resolve(__dirname, '..');
  const url = testDatabaseUrl();
  const name = testDatabaseName(url);

  // 주소(비밀번호 포함)는 명령줄이 아닌 환경변수로만 넘기고, 실패 메시지에도 남기지 않는다.
  const run = (cmd: string, databaseUrl: string, input?: string) => {
    try {
      execSync(cmd, { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, input, stdio: 'pipe' });
    } catch (e) {
      const err = e as { stderr?: Buffer; stdout?: Buffer };
      const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.split(databaseUrl).join('<DATABASE_URL>');
      throw new Error(`테스트 DB 준비 실패 (${cmd}):\n${out}`);
    }
  };

  // 테스트 DB가 아직 없을 수 있으므로 같은 서버의 기존 DB로 접속해 테스트 DB만 지우고 다시 만든다.
  run(
    'npx prisma db execute --stdin --schema prisma/schema.prisma',
    serverUrl(),
    `DROP DATABASE IF EXISTS \`${name}\`; CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  );
  run('npx prisma db push --skip-generate', url);
}

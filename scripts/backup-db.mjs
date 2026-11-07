// MySQL DB 백업: apps/api/.env 의 DATABASE_URL 을 읽어 backups/<db>-YYYYMMDD-HHMMSS.sql 로 저장한다.
// 비밀번호는 명령줄이 아닌 MYSQL_PWD 환경변수로만 넘기고 화면에 출력하지 않는다.
// 사용: npm run db:backup   (또는 backup-db.bat 더블클릭)
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readDatabaseUrl() {
  const envFile = join(root, 'apps', 'api', '.env');
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(envFile)) throw new Error('apps/api/.env 가 없습니다.');
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
    if (m) return m[1].replace(/^(['"])(.*)\1$/, '$2');
  }
  throw new Error('apps/api/.env 에 DATABASE_URL 이 없습니다.');
}

function findMysqldump() {
  if (process.env.MYSQLDUMP) return process.env.MYSQLDUMP;
  const candidates = ['8.4', '9.0', '8.0'].map((v) => `C:\\Program Files\\MySQL\\MySQL Server ${v}\\bin\\mysqldump.exe`);
  return candidates.find((p) => existsSync(p)) ?? 'mysqldump'; // 없으면 PATH 에서 찾기
}

const url = new URL(readDatabaseUrl());
if (url.protocol !== 'mysql:') throw new Error('DATABASE_URL 이 MySQL 주소가 아닙니다.');
const db = decodeURIComponent(url.pathname.replace(/^\//, ''));
if (!/^[A-Za-z0-9_]+$/.test(db)) throw new Error(`DB 이름이 올바르지 않습니다: ${db}`);

const stamp = new Date().toLocaleString('sv-SE').replace(/[-: ]/g, '').replace(/^(\d{8})(\d{6})$/, '$1-$2');
const outDir = join(root, 'backups');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${db}-${stamp}.sql`);

const args = [
  `--host=${url.hostname || 'localhost'}`,
  `--port=${url.port || '3306'}`,
  `--user=${decodeURIComponent(url.username)}`,
  '--single-transaction', // InnoDB: 잠금 없이 일관된 스냅샷
  '--routines',
  '--triggers',
  '--default-character-set=utf8mb4',
  '--no-tablespaces', // PROCESS 권한 없이 백업
  '--databases',
  db,
];

const out = createWriteStream(outFile);
const child = spawn(findMysqldump(), args, {
  env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
child.stdout.pipe(out);
child.stderr.on('data', (d) => (stderr += d));
child.on('error', (e) => {
  console.error(`mysqldump 를 실행할 수 없습니다 (${e.message}). MySQL 설치 경로를 MYSQLDUMP 환경변수로 지정하세요.`);
  process.exitCode = 1;
});
child.on('close', (code) => {
  out.end(() => {
    // 비밀번호 사용 경고 외의 메시지만 표시
    const msg = stderr.split(/\r?\n/).filter((l) => l && !/password on the command line|Using a password/i.test(l)).join('\n');
    if (code !== 0) {
      if (existsSync(outFile)) unlinkSync(outFile);
      console.error(`백업 실패 (exit ${code})\n${msg}`);
      process.exitCode = 1;
      return;
    }
    const kb = Math.round(statSync(outFile).size / 1024);
    console.log(`백업 완료: ${outFile} (${kb} KB)`);
    console.log(`복원: mysql -u ${decodeURIComponent(url.username)} -p < "${outFile}"`);
  });
});

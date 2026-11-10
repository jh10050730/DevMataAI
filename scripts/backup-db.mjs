// SQLite DB 백업: 실행 중인 앱이 쓰고 있어도 일관된 사본을 backups/devmata-YYYYMMDD-HHMMSS.db 로 만든다 (VACUUM INTO).
// 사용: npm run db:backup   (또는 backup-db.bat 더블클릭)
// 복원: 앱을 끈 뒤 백업 파일을 DB 파일 위치(.env 의 DATABASE_URL)에 복사한다.
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { backupName, databaseFile, openDatabase, root, sqlString } from './db-tools.mjs';

export async function backup(source, outDir) {
  if (!existsSync(source)) throw new Error(`DB 파일이 없습니다: ${source}`);
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, backupName());
  if (existsSync(target)) throw new Error(`같은 이름의 백업이 이미 있습니다: ${target}`);
  const db = await openDatabase(source, { readOnly: true });
  try { db.exec(`VACUUM INTO ${sqlString(target)};`); } finally { db.close(); }
  return target;
}

async function main() {
  const source = databaseFile();
  const target = await backup(source, join(root, 'backups'));
  console.log(`백업 완료: ${target} (${Math.round(statSync(target).size / 1024)} KB)`);
  console.log('복원: 앱(서버)을 끈 뒤 이 파일을 DB 위치에 복사하세요 →', source);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });

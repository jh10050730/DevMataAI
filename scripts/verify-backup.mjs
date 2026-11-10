// 백업 복원 검증: 최신(또는 지정한) 백업 파일을 임시 사본으로 열어
// SQLite 무결성 검사, 테이블 구조가 현재 DB와 같은지, 마이그레이션 기록, 테이블별 행 수를 확인한다. 원본 백업과 DB는 바꾸지 않는다.
import { copyFileSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { databaseFile, openDatabase, root } from './db-tools.mjs';

/** 테이블 이름 → CREATE TABLE 문 (구조 비교용) */
function schemaOf(db) {
  return Object.fromEntries(db.prepare("SELECT name, sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => [r.name, r.sql]));
}

export async function inspect(file) {
  const db = await openDatabase(file, { readOnly: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check;').all().map(r => r.integrity_check);
    const schema = schemaOf(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
    const rows = Object.fromEntries(tables.map(t => [t, db.prepare(`SELECT COUNT(*) AS c FROM "${t.replace(/"/g, '""')}"`).get().c]));
    const migrations = tables.includes('_prisma_migrations')
      ? db.prepare('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name').all().map(r => r.migration_name)
      : [];
    return { integrity, schema, tables, rows, migrations };
  } finally { db.close(); }
}

/** 백업 검사 결과와 현재 DB 검사 결과를 비교해 문제 목록을 돌려준다 (빈 배열이면 통과). */
export function compare(backup, live) {
  const problems = [];
  if (backup.integrity.join() !== 'ok') problems.push(`무결성 검사 실패: ${backup.integrity.slice(0, 3).join('; ')}`);
  if (!backup.tables.includes('_prisma_migrations')) problems.push('마이그레이션 기록이 없습니다.');
  const lastBackup = backup.migrations.at(-1); const lastLive = live?.migrations.at(-1);
  // 백업 이후 새 마이그레이션이 생겼다면 구조가 다른 게 정상이므로, 같은 마이그레이션일 때만 구조를 비교한다.
  if (live && lastBackup === lastLive) {
    for (const [name, sql] of Object.entries(live.schema)) if (backup.schema[name] !== sql) problems.push(`구조가 다릅니다: ${name}`);
  }
  if (!backup.tables.some(t => t !== '_prisma_migrations')) problems.push('테이블이 없습니다.');
  return problems;
}

async function main() {
  const backups = join(root, 'backups'); mkdirSync(backups, { recursive: true });
  const candidates = readdirSync(backups).filter(n => /^devmata-\d{8}-\d{6}\.db$/.test(n)).sort();
  const source = process.argv[2] ? resolve(process.argv[2]) : candidates.length ? join(backups, candidates.at(-1)) : null;
  if (!source) throw new Error('검증할 백업이 없습니다. npm run db:backup 을 먼저 실행하세요.');
  // 원본 백업을 건드리지 않도록 임시 사본에서 검사한다.
  const dir = mkdtempSync(join(tmpdir(), 'devmata-verify-'));
  const copy = join(dir, 'restore-check.db');
  let report;
  try {
    copyFileSync(source, copy);
    const result = await inspect(copy);
    let live = null; try { live = await inspect(databaseFile()); } catch { /* 현재 DB가 없으면 백업 단독 검사 */ }
    const problems = compare(result, live);
    if (problems.length) throw new Error(`복원 검증 실패:\n- ${problems.join('\n- ')}`);
    const { _prisma_migrations: _, ...rows } = result.rows;
    report = { verifiedAt: new Date().toISOString(), backup: basename(source), bytes: statSync(source).size, tableCount: Object.keys(rows).length, migration: result.migrations.at(-1), rows };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  writeFileSync(join(backups, 'last-verification.json'), JSON.stringify({ ...report, temporaryCopyRemoved: true }, null, 2));
  console.log(`복원 검증 통과: ${report.backup} · 테이블 ${report.tableCount}개 · 무결성·구조·마이그레이션 확인 · 임시 사본 삭제 완료`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });

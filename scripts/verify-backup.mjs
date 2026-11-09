import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { databaseConfig, dump, mysql, root } from './db-tools.mjs';

// Only redirect database-selection statements, never rewrite text inside INSERT values.
export function restoreSql(sql, source, target) {
  if (!/^[A-Za-z0-9_]+$/.test(source) || !/^[A-Za-z0-9_]+_restorecheck_[a-f0-9]+$/.test(target) || target === source) throw new Error('복원 검증 DB 이름이 올바르지 않습니다.');
  if (!sql.includes('-- Dump completed on')) throw new Error('완료 표시가 없는 백업입니다.');
  if (/^.*(?:SET\s+@@GLOBAL|DROP DATABASE|CREATE USER|GRANT\s)/mi.test(sql)) throw new Error('서버 전역 설정이 포함된 백업은 자동 검증하지 않습니다.');
  // --one-database 모드는 첫 USE 이전 문장을 건너뛰어 덤프 머리의 문자셋·FOREIGN_KEY_CHECKS 설정이 빠진다(ERROR 1824/1231). 맨 앞에서 먼저 전환한다.
  return `USE \`${target}\`;\n` + sql.replace(/^CREATE DATABASE[^\r\n]*;\r?$/gm, line => {
    if (!line.includes('`' + source + '`')) throw new Error('다른 DB 생성문이 발견되었습니다.');
    return '';
  }).replace(/^USE `([^`]+)`;\r?$/gm, (_line, name) => {
    if (name !== source) throw new Error('다른 DB 전환문이 발견되었습니다.');
    return `USE \`${target}\`;`;
  // LOCK TABLES는 복원 속도용이라 결과에 영향이 없고, 앱 계정은 원본 DB에서만 잠금 권한이 있어 임시 DB에서는 거부된다(ERROR 1044).
  }).replace(/^(?:LOCK TABLES `[^`]+` WRITE|UNLOCK TABLES);\r?$/gm, '');
}
export function fingerprints(sql) {
  // 콜레이션이 문자셋을 정하므로 "CHARACTER SET x COLLATE x_..."와 "COLLATE x_..."는 같은 정의다. MySQL은 복원 후 앞의 형태로 보여준다.
  const normalized = sql.replace(/\r\n/g, '\n').replace(/^(  `[^`]+` [^\n]*?)CHARACTER SET (\w+) (COLLATE \2_\w+)/gm, '$1$3');
  const tables = [...normalized.matchAll(/^CREATE TABLE `[^`]+` \([\s\S]*?^\)[^\n]*;/gm)].map(m => m[0]).sort();
  const inserts = [...normalized.matchAll(/^INSERT INTO `[^`]+`[^\n]*;/gm)].map(m => m[0]).sort();
  if (!tables.length) throw new Error('테이블 정의가 없는 백업입니다.');
  const hash = values => createHash('sha256').update(values.join('\n')).digest('hex');
  return { tableCount: tables.length, schemaHash: hash(tables), dataHash: hash(inserts) };
}
async function main() {
  const config = databaseConfig(); const backups = join(root, 'backups'); mkdirSync(backups, { recursive: true });
  if (process.argv.includes('--check-access')) { console.log(await mysql(config, [], 'SHOW GRANTS FOR CURRENT_USER;')); return; }
  const candidates = readdirSync(backups).filter(n => n.startsWith(config.name + '-') && n.endsWith('.sql')).sort();
  const source = process.argv[2] ? resolve(process.argv[2]) : candidates.length ? join(backups, candidates.at(-1)) : null;
  if (!source) throw new Error('검증할 백업이 없습니다. npm run db:backup을 먼저 실행하세요.');
  const sql = readFileSync(source, 'utf8');
  const target = `${config.name.slice(0, 24)}_restorecheck_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const input = restoreSql(sql, config.name, target); const expected = fingerprints(sql);
  const roundtrip = join(backups, `${target}.sql`);
  let created = false; let report;
  try {
    await mysql(config, [], `CREATE DATABASE \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`); created = true;
    await mysql(config, [`--database=${target}`, '--one-database'], input);
    await dump(config, target, roundtrip);
    const actual = fingerprints(readFileSync(roundtrip, 'utf8'));
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('복원 후 스키마 또는 데이터가 백업과 일치하지 않습니다.');
    const tables = (await mysql(config, [`--database=${target}`], 'SHOW TABLES;')).trim().split(/\r?\n/);
    if (tables.some(t => !/^[A-Za-z0-9_]+$/.test(t))) throw new Error('예상하지 못한 테이블 이름입니다.');
    const counts = await mysql(config, [`--database=${target}`], tables.map(t => `SELECT '${t}', COUNT(*) FROM \`${t}\`;`).join('\n'));
    report = { verifiedAt: new Date().toISOString(), backup: basename(source), bytes: statSync(source).size, ...actual, rows: Object.fromEntries(counts.trim().split(/\r?\n/).map(line => { const [table, count] = line.split('\t'); return [table, Number(count)]; })) };
  } finally {
    if (created) await mysql(config, [], `DROP DATABASE \`${target}\`;`);
    try { unlinkSync(roundtrip); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  writeFileSync(join(backups, 'last-verification.json'), JSON.stringify({ ...report, temporaryDatabaseRemoved: true }, null, 2));
  console.log(`복원 검증 통과: ${report.backup} · 테이블 ${report.tableCount}개 · 스키마/데이터 SHA-256 일치 · 임시 DB 제거 완료`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });

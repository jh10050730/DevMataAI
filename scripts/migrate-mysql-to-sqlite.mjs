// 한 번만 쓰는 이전 도구: 기존 MySQL DB의 모든 데이터를 새 SQLite 파일로 옮기고, 행 수와 내용 해시로 검증한다.
// 사용: node scripts/migrate-mysql-to-sqlite.mjs <대상 SQLite 파일>
//   원본: MYSQL_DATABASE_URL 환경변수, 없으면 apps/api/.env 의 DATABASE_URL (mysql:// 일 때만)
//   대상 파일은 비어 있어야 한다 (기존 파일이 있으면 중단). 원본 MySQL 은 읽기만 한다.
import { spawn, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** MySQL JSON_OBJECT 값 → Prisma 필드 타입에 맞는 JS 값 */
export function convertValue(type, value) {
  if (value === null || value === undefined) return null;
  if (type === 'DateTime') {
    // Prisma 는 MySQL DATETIME(3)에 UTC 로 저장한다: "2026-11-09 03:12:45.123000"
    const d = new Date(String(value).replace(' ', 'T') + 'Z');
    if (Number.isNaN(d.getTime())) throw new Error(`날짜 형식을 읽을 수 없습니다: ${value}`);
    return d;
  }
  if (type === 'Boolean') return value === true || value === 1 || value === '1';
  if (type === 'Int') return Number(value);
  return value;
}

/** 비교용 정규화: 키 정렬, 날짜는 ISO 문자열 */
export function rowsHash(rows, fields) {
  const norm = rows.map(r => fields.map(f => { const v = r[f]; return v instanceof Date ? v.toISOString() : v ?? null; }));
  norm.sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1);
  return createHash('sha256').update(JSON.stringify(norm)).digest('hex');
}

function mysqlSource() {
  let raw = process.env.MYSQL_DATABASE_URL;
  if (!raw) {
    const line = readFileSync(join(root, 'apps/api/.env'), 'utf8').split(/\r?\n/).find(l => /^\s*DATABASE_URL\s*=/.test(l));
    raw = line?.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  if (!raw || !raw.startsWith('mysql:')) throw new Error('원본 MySQL 주소가 없습니다. MYSQL_DATABASE_URL 을 지정하세요.');
  const url = new URL(raw);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[A-Za-z0-9_]{1,64}$/.test(name)) throw new Error('MySQL DB 이름을 확인하세요.');
  const exe = process.env.MYSQL || ['8.4', '9.0', '8.0'].map(v => `C:/Program Files/MySQL/MySQL Server ${v}/bin/mysql.exe`).find(existsSync) || 'mysql';
  return {
    name,
    // 비밀번호는 명령줄이 아닌 환경변수로만 넘긴다.
    query: sql => new Promise((ok, fail) => {
      const child = spawn(exe, [`--host=${url.hostname}`, `--port=${url.port || 3306}`, `--user=${decodeURIComponent(url.username)}`, '--default-character-set=utf8mb4', '--batch', '--raw', '--skip-column-names', `--database=${name}`],
        { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, windowsHide: true });
      let out = ''; let err = '';
      child.stdout.setEncoding('utf8').on('data', d => { out += d; });
      child.stderr.on('data', d => { err += d; });
      child.on('error', () => fail(new Error('mysql 실행 파일을 찾을 수 없습니다. MYSQL 환경변수로 지정하세요.')));
      child.on('close', code => code === 0 ? ok(out) : fail(new Error(`MySQL 조회 실패 ${err.match(/ERROR \d+/)?.[0] ?? ''}`)));
      child.stdin.end(sql);
    }),
  };
}

async function main() {
  const target = process.argv[2];
  if (!target || !isAbsolute(resolve(target))) throw new Error('사용: node scripts/migrate-mysql-to-sqlite.mjs <대상 SQLite 파일>');
  const file = resolve(target);
  if (existsSync(file)) throw new Error(`대상 파일이 이미 있습니다. 덮어쓰지 않습니다: ${file}`);
  mkdirSync(dirname(file), { recursive: true });
  const url = `file:${file.replace(/\\/g, '/')}`;
  const source = mysqlSource();

  // 1) 대상 스키마: 실제 배포와 같은 마이그레이션으로 만든다.
  execSync('npx prisma migrate deploy --schema prisma/schema.prisma', { cwd: join(root, 'apps/api'), env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });

  const { PrismaClient, Prisma } = await import(pathToFileURL(join(root, 'node_modules/@prisma/client/index.js')).href);
  // 연결 하나만 써야 PRAGMA foreign_keys=OFF 가 이후 쓰기에 적용된다.
  const db = new PrismaClient({ datasourceUrl: `${url}?connection_limit=1` });
  const tables = (await source.query(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${source.name}';`)).trim().split(/\r?\n/).filter(Boolean);
  const report = [];
  try {
    await db.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
    for (const model of Prisma.dmmf.datamodel.models) {
      const table = tables.find(t => t.toLowerCase() === model.name.toLowerCase());
      const scalars = model.fields.filter(f => f.kind === 'scalar');
      const fields = scalars.map(f => f.name);
      let rows = [];
      if (table) {
        const columns = (await source.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${source.name}' AND TABLE_NAME='${table}';`)).trim().split(/\r?\n/);
        const missing = fields.filter(f => !columns.includes(f));
        if (missing.length) throw new Error(`${model.name}: MySQL 에 없는 열 ${missing.join(', ')}`);
        const out = await source.query(`SELECT JSON_OBJECT(${fields.map(f => `'${f}', \`${f}\``).join(', ')}) FROM \`${table}\`;`);
        rows = out.split(/\r?\n/).filter(Boolean).map(line => {
          const r = JSON.parse(line);
          return Object.fromEntries(scalars.map(f => [f.name, convertValue(f.type, r[f.name])]));
        });
      }
      const delegate = db[model.name[0].toLowerCase() + model.name.slice(1)];
      for (let i = 0; i < rows.length; i += 200) await delegate.createMany({ data: rows.slice(i, i + 200) });
      const back = await delegate.findMany();
      const ok = back.length === rows.length && rowsHash(back, fields) === rowsHash(rows, fields);
      report.push({ model: model.name, rows: rows.length, ok });
      if (!ok) throw new Error(`${model.name}: 옮긴 데이터가 원본과 다릅니다 (원본 ${rows.length}행, 대상 ${back.length}행).`);
    }
    const broken = await db.$queryRawUnsafe('PRAGMA foreign_key_check;');
    if (broken.length) throw new Error(`외래 키 불일치 ${broken.length}건`);
    const integrity = await db.$queryRawUnsafe('PRAGMA integrity_check;');
    if (integrity[0]?.integrity_check !== 'ok') throw new Error('SQLite 무결성 검사 실패');
    await db.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
  } finally {
    await db.$disconnect();
  }
  for (const r of report) console.log(`${r.ok ? '✓' : '✗'} ${r.model.padEnd(20)} ${r.rows}행`);
  console.log(`이전 완료: ${file} · 모델 ${report.length}개 · 행 수·내용 해시·외래 키·무결성 검사 통과`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });

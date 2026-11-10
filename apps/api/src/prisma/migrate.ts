import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** $executeRawUnsafe / $queryRawUnsafe 만 쓰는 최소 인터페이스 (PrismaClient 와 트랜잭션 클라이언트 모두 해당) */
export interface RawDb {
  $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]): Promise<T>;
}

/** Prisma CLI 가 SQLite 에 만드는 것과 같은 기록 테이블 (개발용 `prisma migrate` 와 호환) */
const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

/** Prisma 가 만든 migration.sql 을 문장 단위로 나눈다. (트리거처럼 본문에 ; 가 들어가는 문장은 지원하지 않는다) */
export function splitStatements(sql: string): string[] {
  if (/\bCREATE\s+TRIGGER\b/i.test(sql)) throw new Error('트리거가 있는 마이그레이션은 자동 적용을 지원하지 않습니다.');
  return sql
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map(s => s.split(/\r?\n/).filter(line => !/^\s*--/.test(line)).join('\n').trim())
    .filter(Boolean);
}

export const checksum = (sql: string) => createHash('sha256').update(sql).digest('hex');

/**
 * 설치된 데스크톱 앱처럼 Prisma CLI 가 없는 환경에서 migrations 폴더의 마이그레이션을 순서대로 적용한다.
 * 이미 적용된 것은 건너뛰고, 실패하면 그 마이그레이션 전체를 되돌린다. 적용한 이름 목록을 돌려준다.
 */
export async function applyMigrations(db: RawDb & { $transaction<T>(fn: (tx: RawDb) => Promise<T>): Promise<T> }, dir: string): Promise<string[]> {
  if (!existsSync(dir)) throw new Error(`마이그레이션 폴더가 없습니다: ${dir}`);
  await db.$executeRawUnsafe(MIGRATIONS_TABLE);
  const rows = await db.$queryRawUnsafe<{ migration_name: string; checksum: string; finished_at: unknown; rolled_back_at: unknown }[]>(
    'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"',
  );
  const failed = rows.find(r => r.finished_at === null && r.rolled_back_at === null);
  if (failed) throw new Error(`이전에 실패한 마이그레이션이 있습니다: ${failed.migration_name}`);
  const done = new Map(rows.filter(r => r.finished_at !== null).map(r => [r.migration_name, r.checksum]));
  const names = readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(dir, d.name, 'migration.sql'))).map(d => d.name).sort();
  const applied: string[] = [];
  for (const name of names) {
    const sql = readFileSync(join(dir, name, 'migration.sql'), 'utf8');
    const sum = checksum(sql);
    if (done.has(name)) {
      // 줄바꿈(CRLF/LF)만 다른 경우는 같은 파일로 본다 (Windows git 체크아웃 차이).
      const lf = sql.replace(/\r\n/g, '\n');
      if (![sum, checksum(lf), checksum(lf.replace(/\n/g, '\r\n'))].includes(done.get(name)!)) throw new Error(`적용된 마이그레이션 파일이 바뀌었습니다: ${name}`);
      continue;
    }
    const statements = splitStatements(sql);
    await db.$transaction(async tx => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      await tx.$executeRawUnsafe(
        'INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (?, ?, current_timestamp, ?, current_timestamp, ?)',
        randomUUID(), sum, name, statements.length,
      );
    });
    applied.push(name);
  }
  return applied;
}

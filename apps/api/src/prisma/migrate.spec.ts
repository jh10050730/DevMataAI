import { PrismaClient } from '@prisma/client';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyMigrations, checksum, splitStatements } from './migrate';
import { PRISMA_DIR } from './database-url';

describe('splitStatements', () => {
  it('splits Prisma migration SQL and drops comment lines', () => {
    const sql = '-- CreateTable\nCREATE TABLE "A" (\n  "id" TEXT NOT NULL\n);\n\n-- CreateIndex\nCREATE UNIQUE INDEX "A_id" ON "A"("id");\n';
    expect(splitStatements(sql)).toEqual(['CREATE TABLE "A" (\n  "id" TEXT NOT NULL\n)', 'CREATE UNIQUE INDEX "A_id" ON "A"("id")']);
  });
  it('keeps semicolons inside string values on the same line', () => {
    expect(splitStatements("INSERT INTO x VALUES ('a;b');")).toEqual(["INSERT INTO x VALUES ('a;b')"]);
  });
  it('refuses triggers', () => {
    expect(() => splitStatements('CREATE TRIGGER t AFTER INSERT ON a BEGIN SELECT 1; END;')).toThrow();
  });
});

describe('applyMigrations', () => {
  let dir: string;
  let db: PrismaClient;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'devmata-migrate-'));
    db = new PrismaClient({ datasourceUrl: `file:${join(dir, 'app-test.db').replace(/\\/g, '/')}` });
  });
  afterEach(async () => {
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  it('applies the real migrations once, in a Prisma-compatible history table', async () => {
    const migrations = join(PRISMA_DIR, 'migrations');
    const first = await applyMigrations(db, migrations);
    expect(first.length).toBeGreaterThan(0);
    expect(await applyMigrations(db, migrations)).toEqual([]);
    const rows = await db.$queryRawUnsafe<{ migration_name: string; checksum: string }[]>('SELECT migration_name, checksum FROM "_prisma_migrations"');
    expect(rows.map(r => r.migration_name)).toEqual(first);
    // 실제 스키마로 쓰기·읽기가 된다
    await db.user.create({ data: { email: 'a@example.com', name: 'A', passwordHash: 'x' } });
    expect(await db.user.count()).toBe(1);
  });

  it('rolls back a failing migration and refuses edited history', async () => {
    const migrations = join(dir, 'migrations');
    mkdirSync(join(migrations, '1_ok'), { recursive: true });
    writeFileSync(join(migrations, '1_ok', 'migration.sql'), 'CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY);\n');
    mkdirSync(join(migrations, '2_bad'));
    writeFileSync(join(migrations, '2_bad', 'migration.sql'), 'CREATE TABLE "U" ("id" TEXT);\nTHIS IS NOT SQL;\n');
    await expect(applyMigrations(db, migrations)).rejects.toThrow();
    const tables = await db.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('T','U')");
    expect(tables.map(t => t.name)).toEqual(['T']);
    rmSync(join(migrations, '2_bad'), { recursive: true });
    // 줄바꿈만 바뀐 것은 허용
    writeFileSync(join(migrations, '1_ok', 'migration.sql'), 'CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY);\r\n');
    expect(await applyMigrations(db, migrations)).toEqual([]);
    writeFileSync(join(migrations, '1_ok', 'migration.sql'), 'CREATE TABLE "T" ("id" TEXT);\n');
    await expect(applyMigrations(db, migrations)).rejects.toThrow(/바뀌었습니다/);
    expect(checksum('a')).toHaveLength(64);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { backup } from './backup-db.mjs';
import { compare, inspect } from './verify-backup.mjs';
import { backupName, fileFromUrl, sqlString } from './db-tools.mjs';

const makeDb = file => {
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE _prisma_migrations (id TEXT, migration_name TEXT, finished_at DATETIME, rolled_back_at DATETIME);
    INSERT INTO _prisma_migrations VALUES ('1', '20261110000000_init', CURRENT_TIMESTAMP, NULL);
    CREATE TABLE "Note" (id TEXT PRIMARY KEY, body TEXT); INSERT INTO "Note" VALUES ('n1', '한글 '' 따옴표');`);
  db.close();
};

test('backup copies a live database and the copy passes verification', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'devmata-test-'));
  try {
    const live = join(dir, "live's.db"); makeDb(live);
    const file = await backup(live, join(dir, 'backups'));
    assert.match(file, /devmata-\d{8}-\d{6}\.db$/);
    const result = await inspect(file);
    assert.deepEqual(compare(result, await inspect(live)), []);
    assert.equal(result.rows.Note, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('verification reports structure differences and broken files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'devmata-test-'));
  try {
    const a = join(dir, 'a.db'); makeDb(a);
    const b = join(dir, 'b.db'); makeDb(b);
    const db = new DatabaseSync(b); db.exec('ALTER TABLE "Note" ADD COLUMN extra TEXT;'); db.close();
    assert.match(compare(await inspect(a), await inspect(b)).join(), /구조가 다릅니다: Note/);
    const broken = join(dir, 'broken.db'); writeFileSync(broken, readFileSync(a).subarray(0, 1000));
    await assert.rejects(inspect(broken));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('helpers resolve paths like Prisma and quote SQL strings', () => {
  assert.match(fileFromUrl('file:../../../data/devmata.db', 'C:/repo/apps/api/prisma'), /repo[\\/]data[\\/]devmata\.db$/);
  assert.throws(() => fileFromUrl('mysql://u:p@h/db'));
  assert.equal(sqlString("a'b"), "'a''b'");
  assert.equal(backupName(new Date(2026, 10, 10, 9, 5, 7)), 'devmata-20261110-090507.db');
});

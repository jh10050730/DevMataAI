import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { BackupService, backupName, isDue, listBackups, toPrune } from './backup.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('자동 백업', () => {
  it('이름 규칙은 scripts/db-tools.mjs 와 같다', () => {
    expect(backupName(new Date(2026, 10, 10, 9, 5, 7))).toBe('devmata-20261110-090507.db');
  });

  it('오늘 날짜 백업이 있으면 다시 만들지 않는다', () => {
    const now = new Date(2026, 10, 10, 23, 0, 0);
    expect(isDue([], now)).toBe(true);
    expect(isDue(['devmata-20261109-120000.db'], now)).toBe(true);
    expect(isDue(['devmata-20261109-120000.db', 'devmata-20261110-000100.db'], now)).toBe(false);
  });

  it('최근 keep 개만 남기고, 규칙에 맞지 않는 파일은 건드리지 않는다', () => {
    const names = Array.from({ length: 9 }, (_, i) => `devmata-202611${String(i + 1).padStart(2, '0')}-120000.db`);
    expect(toPrune([...names, 'my-copy.db', 'last-verification.json'], 7)).toEqual(names.slice(0, 2));
    expect(toPrune(names.slice(0, 3), 7)).toEqual([]);
    expect(toPrune(names.slice(0, 3), 0)).toEqual(names.slice(0, 2)); // 최소 1개는 남긴다
  });

  describe('실제 DB 백업', () => {
    let dir: string;
    let db: PrismaClient;
    const env = { ...process.env };

    beforeAll(async () => {
      dir = mkdtempSync(join(tmpdir(), 'devmata-backup-'));
      db = new PrismaClient({ datasourceUrl: `file:${join(dir, 'live.db').replace(/\\/g, '/')}` });
      await db.$executeRawUnsafe('CREATE TABLE note (id INTEGER PRIMARY KEY, body TEXT)');
      await db.$executeRawUnsafe("INSERT INTO note (body) VALUES ('안녕')");
    });
    afterAll(async () => {
      await db.$disconnect();
      process.env = env;
      rmSync(dir, { recursive: true, force: true });
    });

    it('폴더 설정이 없으면 아무것도 하지 않는다', async () => {
      delete process.env.DB_BACKUP_DIR;
      const service = new BackupService(db as unknown as PrismaService);
      expect(service.status().enabled).toBe(false);
      await expect(service.runIfDue()).resolves.toBeNull();
    });

    it('하루 한 번 사본을 만들고 오래된 것을 정리한다', async () => {
      const backups = join(dir, 'backups (내 폴더)');
      process.env.DB_BACKUP_DIR = backups;
      process.env.DB_BACKUP_KEEP = '2';
      const service = new BackupService(db as unknown as PrismaService);

      const first = await service.runIfDue(new Date(2026, 10, 8, 10, 0, 0));
      expect(first).toMatch(/devmata-20261108-100000\.db$/);
      await expect(service.runIfDue(new Date(2026, 10, 8, 18, 0, 0))).resolves.toBeNull();

      writeFileSync(join(backups, 'my-copy.db'), 'x');
      await service.runIfDue(new Date(2026, 10, 9, 10, 0, 0));
      await service.runIfDue(new Date(2026, 10, 10, 10, 0, 0));
      expect(listBackups(backups)).toEqual(['devmata-20261109-100000.db', 'devmata-20261110-100000.db']);
      expect(readdirSync(backups)).toContain('my-copy.db');
      expect(readdirSync(backups).some(n => n.endsWith('.tmp'))).toBe(false);

      const copy = new PrismaClient({ datasourceUrl: `file:${join(backups, 'devmata-20261110-100000.db').replace(/\\/g, '/')}` });
      try {
        await expect(copy.$queryRawUnsafe('SELECT body FROM note')).resolves.toEqual([{ body: '안녕' }]);
      } finally {
        await copy.$disconnect();
      }
      expect(service.status()).toMatchObject({ enabled: true, keep: 2, count: 2, latest: 'devmata-20261110-100000.db' });
    });
  });
});

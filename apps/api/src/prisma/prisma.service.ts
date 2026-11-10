import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PRISMA_DIR, databaseFile, resolveDatabaseUrl } from './database-url';
import { applyMigrations } from './migrate';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const datasourceUrl = resolveDatabaseUrl(process.env.DATABASE_URL);
    mkdirSync(dirname(databaseFile(datasourceUrl)), { recursive: true });
    super({ datasourceUrl });
  }

  async onModuleInit() {
    await this.$connect();
    // WAL: 읽기와 쓰기가 서로 막지 않게 한다 (DB 파일 옆에 -wal, -shm 파일이 생긴다).
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    // 데스크톱 앱: Prisma CLI 없이 시작할 때 마이그레이션을 적용한다.
    if (process.env.DB_AUTO_MIGRATE === 'true') {
      const applied = await applyMigrations(this, process.env.DB_MIGRATIONS_DIR || join(PRISMA_DIR, 'migrations'));
      if (applied.length) this.logger.log(`DB 마이그레이션 적용: ${applied.join(', ')}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

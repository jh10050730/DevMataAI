import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { databaseFile, resolveDatabaseUrl } from './database-url';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const datasourceUrl = resolveDatabaseUrl(process.env.DATABASE_URL);
    mkdirSync(dirname(databaseFile(datasourceUrl)), { recursive: true });
    super({ datasourceUrl });
  }

  async onModuleInit() {
    await this.$connect();
    // WAL: 읽기와 쓰기가 서로 막지 않게 한다 (DB 파일 옆에 -wal, -shm 파일이 생긴다).
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

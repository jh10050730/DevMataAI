import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

/** scripts/db-tools.mjs 의 backupName 과 같은 이름 규칙 (npm run db:verify-backup 이 그대로 읽는다) */
export const BACKUP_PATTERN = /^devmata-(\d{8})-\d{6}\.db$/;
export const DEFAULT_KEEP = 7;
const CHECK_EVERY_MS = 60 * 60_000;
const FIRST_CHECK_MS = 60_000;

const pad = (n: number) => String(n).padStart(2, '0');
export const backupDay = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
export const backupName = (d: Date) => `devmata-${backupDay(d)}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.db`;

/** 백업 폴더 안의 백업 파일 이름 (오래된 것 → 최신 순) */
export function listBackups(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => BACKUP_PATTERN.test(n)).sort();
}

/** 오늘 날짜 백업이 아직 없으면 true */
export function isDue(names: string[], now: Date): boolean {
  const today = backupDay(now);
  return !names.some(n => BACKUP_PATTERN.exec(n)?.[1] === today);
}

/** 최근 keep 개만 남기고 지울 이름. 규칙에 맞는 백업 파일만 대상이다 */
export function toPrune(names: string[], keep: number): string[] {
  const sorted = names.filter(n => BACKUP_PATTERN.test(n)).sort();
  return sorted.slice(0, Math.max(0, sorted.length - Math.max(1, keep)));
}

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

/**
 * 데스크톱 앱 자동 백업: 하루 한 번 DB 전체를 DB_BACKUP_DIR 에 복사하고 최근 DB_BACKUP_KEEP(기본 7)개만 남긴다.
 * VACUUM INTO 는 앱이 DB 를 쓰는 중에도 일관된 사본을 만든다. DB_BACKUP_DIR 이 없으면 (개발 서버·테스트) 꺼져 있다.
 */
@Injectable()
export class BackupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Backup');
  private timers: ReturnType<typeof setTimeout>[] = [];
  private running?: Promise<string | null>;

  constructor(private readonly db: PrismaService) {}

  get dir(): string | null {
    const dir = process.env.DB_BACKUP_DIR?.trim();
    return dir ? resolve(dir) : null;
  }

  get keep(): number {
    const n = Number(process.env.DB_BACKUP_KEEP);
    return Number.isInteger(n) && n >= 1 && n <= 365 ? n : DEFAULT_KEEP;
  }

  onModuleInit() {
    if (!this.dir || process.env.NODE_ENV === 'test') return;
    // 시작 직후는 마이그레이션·동기화로 바쁘므로 1분 뒤 처음 확인하고, 그 뒤 한 시간마다 확인한다.
    const first = setTimeout(() => void this.runIfDue(), FIRST_CHECK_MS);
    const every = setInterval(() => void this.runIfDue(), CHECK_EVERY_MS);
    first.unref(); every.unref();
    this.timers = [first, every];
  }

  onModuleDestroy() {
    for (const t of this.timers) clearTimeout(t);
  }

  /** 오늘 백업이 없으면 만든다. 만든 파일 경로, 할 일이 없으면 null */
  runIfDue(now = new Date()): Promise<string | null> {
    if (this.running) return this.running;
    this.running = (async () => {
      const dir = this.dir;
      if (!dir || !isDue(listBackups(dir), now)) return null;
      try {
        return await this.backup(now);
      } catch (error) {
        this.logger.warn(`자동 백업 실패, 한 시간 뒤 다시 시도합니다: ${(error as Error).message}`);
        return null;
      }
    })().finally(() => { this.running = undefined; });
    return this.running;
  }

  /** 지금 백업하고 오래된 백업을 정리한다 */
  async backup(now = new Date()): Promise<string> {
    const dir = this.dir;
    if (!dir) throw new Error('DB_BACKUP_DIR 이 설정되지 않았습니다.');
    mkdirSync(dir, { recursive: true });
    const target = join(dir, backupName(now));
    // 쓰는 도중의 파일이 백업 목록에 잡히지 않도록 임시 이름으로 만든 뒤 바꾼다.
    const temp = `${target}.tmp`;
    rmSync(temp, { force: true });
    try {
      await this.db.$executeRawUnsafe(`VACUUM INTO ${sqlString(temp)}`);
      renameSync(temp, target);
    } finally {
      rmSync(temp, { force: true });
    }
    for (const name of toPrune(listBackups(dir), this.keep)) rmSync(join(dir, name), { force: true });
    this.logger.log(`자동 백업: ${target} (${Math.round(statSync(target).size / 1024)}KB)`);
    return target;
  }

  status() {
    const dir = this.dir;
    const names = dir ? listBackups(dir) : [];
    return { enabled: !!dir, dir, keep: this.keep, count: names.length, latest: names.at(-1) ?? null };
  }
}

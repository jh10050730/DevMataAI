import { ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { isDesktop, sendToDesktop, type DesktopMessage } from '../common/desktop';

export const FOLDER_TARGETS = ['data', 'logs'] as const;
export type FolderTarget = (typeof FOLDER_TARGETS)[number];
export const UPDATE_ACTIONS = ['check', 'install'] as const;
export type UpdateAction = (typeof UPDATE_ACTIONS)[number];
const UPDATE_STATES = ['idle', 'checking', 'available', 'downloading', 'ready', 'error'] as const;
export interface UpdateState { state: (typeof UPDATE_STATES)[number]; version?: string; percent?: number; error?: string }

/** 앱이 보낸 업데이트 상태 메시지를 검사해 정해진 필드만 남긴다. 아니면 null */
export function parseUpdateState(message: unknown): UpdateState | null {
  if (!message || typeof message !== 'object') return null;
  const m = message as Record<string, unknown>;
  if (m.type !== 'update-state' || !UPDATE_STATES.includes(m.state as UpdateState['state'])) return null;
  const out: UpdateState = { state: m.state as UpdateState['state'] };
  if (typeof m.version === 'string' && /^\d+\.\d+\.\d+$/.test(m.version)) out.version = m.version;
  if (typeof m.percent === 'number' && m.percent >= 0 && m.percent <= 100) out.percent = Math.round(m.percent);
  if (typeof m.error === 'string') out.error = m.error.slice(0, 300);
  return out;
}

type Send = (message: unknown) => boolean;

/** apps/api/package.json 의 버전 (src·dist·설치본 resources/api 어디서 실행해도 두 단계 위) */
function packageVersion(): string {
  try {
    return String(JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'package.json'), 'utf8')).version ?? '0.0.0');
  } catch {
    return '0.0.0';
  }
}

/**
 * 데스크톱 앱 정보와 폴더 열기 (docs/DESKTOP_PLAN.md 의 인터페이스 약속).
 * 데스크톱 앱이 DEVMATA_VERSION · DEVMATA_DATA_DIR · DEVMATA_LOG_DIR 을 넘겨준다 (apps/desktop/src/paths.cjs apiEnv).
 */
@Injectable()
export class DesktopService implements OnModuleInit, OnModuleDestroy {
  private update: UpdateState | null = null;
  private readonly onMessage = (message: unknown) => { this.receive(message); };

  constructor(private readonly db: PrismaService) {}

  onModuleInit() { if (isDesktop()) process.on('message', this.onMessage); }
  onModuleDestroy() { process.off('message', this.onMessage); }

  /** 앱(메인 프로세스)이 보낸 메시지. 업데이트 상태만 받는다 */
  receive(message: unknown) {
    const state = parseUpdateState(message);
    if (state) this.update = state;
  }

  info() {
    const version = process.env.DEVMATA_VERSION?.trim() || packageVersion();
    if (!isDesktop()) return { desktop: false, version };
    return {
      desktop: true,
      version,
      dataDir: process.env.DEVMATA_DATA_DIR || undefined,
      logDir: process.env.DEVMATA_LOG_DIR || undefined,
      update: this.update ?? undefined,
    };
  }

  /** 업데이트 확인, 또는 받아 둔 업데이트를 설치하며 재시작 (설치는 받아 둔 것이 있을 때만) */
  requestUpdate(action: UpdateAction, send?: Send | null) {
    if (!isDesktop()) throw new NotFoundException('데스크톱 앱에서만 쓸 수 있습니다.');
    if (action === 'install' && this.update?.state !== 'ready') throw new ConflictException('아직 받아 둔 업데이트가 없습니다.');
    if (!sendToDesktop({ type: 'update', action }, send)) {
      throw new ServiceUnavailableException('앱에 요청을 전달하지 못했습니다. 앱을 다시 실행해 보세요.');
    }
  }

  /** 탐색기로 데이터·로그 폴더 열기. 처음 가입한 관리자만 (앱 설정과 같은 기준) */
  async open(userId: string, target: FolderTarget, send?: Send | null) {
    if (!isDesktop()) throw new NotFoundException('데스크톱 앱에서만 쓸 수 있습니다.');
    const first = await this.db.user.findFirst({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } });
    if (!first || first.id !== userId) throw new ForbiddenException('폴더 열기는 처음 가입한 관리자 계정만 할 수 있습니다.');
    const message: DesktopMessage = { type: 'open-folder', target };
    if (!sendToDesktop(message, send)) {
      throw new ServiceUnavailableException('앱에 요청을 전달하지 못했습니다. 앱을 다시 실행해 보세요.');
    }
  }
}

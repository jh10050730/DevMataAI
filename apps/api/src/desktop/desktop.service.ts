import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { isDesktop, sendToDesktop, type DesktopMessage } from '../common/desktop';

export const FOLDER_TARGETS = ['data', 'logs'] as const;
export type FolderTarget = (typeof FOLDER_TARGETS)[number];

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
export class DesktopService {
  constructor(private readonly db: PrismaService) {}

  info() {
    const version = process.env.DEVMATA_VERSION?.trim() || packageVersion();
    if (!isDesktop()) return { desktop: false, version };
    return {
      desktop: true,
      version,
      dataDir: process.env.DEVMATA_DATA_DIR || undefined,
      logDir: process.env.DEVMATA_LOG_DIR || undefined,
    };
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

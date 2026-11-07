import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai/ai.service';
import { NotionService } from './notion.service';

/** 외부 서비스 연결 상태 (실제 연결 / 데모 / 미설정). 토큰 값은 절대 반환하지 않는다. */
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly ai: AiService,
    private readonly notion: NotionService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  async status() {
    const [ai, notion] = await Promise.all([this.ai.status(), this.notion.status()]);
    return {
      ai,
      notion,
      github: { configured: !!this.config.get('GITHUB_TOKEN'), detail: 'Phase 4 에서 연결 예정' },
      googleCalendar: {
        configured: !!(this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET')),
        detail:
          this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET')
            ? '아래에서 Google 계정을 연결하세요 (읽기 전용)'
            : 'Google OAuth 클라이언트가 설정되지 않았습니다 (apps/api/.env 의 GOOGLE_CLIENT_ID 등).',
      },
    };
  }
}

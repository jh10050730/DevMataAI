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
      github: { configured: !!this.config.get('GITHUB_TOKEN'), detail: this.config.get('GITHUB_TOKEN') ? '프로젝트에서 권한이 있는 저장소의 활동을 조회할 수 있습니다.' : '공개 저장소는 토큰 없이 조회할 수 있습니다. 프로젝트에 owner/repository를 입력하세요.' },
      googleCalendar: {
        configured: !!(this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET')),
        detail:
          this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET')
            ? '본인 Google 계정의 기본 캘린더 일정을 읽기 전용으로 가져와요.'
            : 'Google 연동 키가 없어요. 처음 가입한 관리자 계정으로 설정 → 앱 연결 설정에서 Google 클라이언트 ID·비밀번호를 넣어 주세요.',
      },
    };
  }
}

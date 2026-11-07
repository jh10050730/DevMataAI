import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  status() {
    return this.ai.status();
  }

  /** 설정 화면의 "연결 테스트" */
  @HttpCode(200)
  @Post('test')
  async test(@CurrentUser() user: AuthUser) {
    const started = Date.now();
    const r = await this.ai.complete(user.id, 'connection-test', {
      system: 'You are a connection test. Reply with exactly one short Korean sentence.',
      prompt: '연결 테스트입니다. "연결 성공"이라고 답해주세요.',
    });
    return { ...r, latencyMs: Date.now() - started };
  }
}

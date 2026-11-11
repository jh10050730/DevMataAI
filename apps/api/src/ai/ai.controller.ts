import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { ChatGptService } from './chatgpt.service';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { AiService } from './ai.service';
import { ClaudeCodeService } from './claude-code.service';
import { GeminiService } from './gemini.service';

class AiSelectionDto { @IsIn(['claude-cli', 'chatgpt', 'gemini']) provider: 'claude-cli' | 'chatgpt' | 'gemini'; }
class ChatGptModelDto { @IsString() @MaxLength(200) model: string; }

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService, private readonly claudeCode: ClaudeCodeService, private readonly chatgpt: ChatGptService, private readonly gemini: GeminiService) {}

  @Get('selection') selection(@CurrentUser() user: AuthUser) { return this.ai.selection(user.id); }
  @Get('models') models(@CurrentUser() user: AuthUser) { return this.ai.models(user.id); }
  @Get('connections') connections(@CurrentUser() user: AuthUser) { return this.ai.connections(user.id); }
  @Post('claude-code/connect') connectClaude(@CurrentUser() user: AuthUser) { return this.ai.connectClaude(user.id); }
  @Post('claude-code/disconnect') disconnectClaude(@CurrentUser() user: AuthUser) { return this.ai.disconnectClaude(user.id); }
  @Get('gemini') geminiStatus(@CurrentUser() user: AuthUser) { return this.gemini.status(user.id); }
  @Post('gemini/connect') connectGemini(@CurrentUser() user: AuthUser) { return this.gemini.start(user.id); }
  @Post('gemini/disconnect') disconnectGemini(@CurrentUser() user: AuthUser) { return this.gemini.disconnect(user.id); }
  @Post('gemini/cancel') cancelGemini(@CurrentUser() user: AuthUser) { return this.gemini.disconnect(user.id); }
  @Patch('selection') select(@CurrentUser() user: AuthUser, @Body() dto: AiSelectionDto) { return this.ai.select(user.id, dto.provider); }
  @Get('chatgpt') chatGptStatus(@CurrentUser() user: AuthUser) { return this.chatgpt.status(user.id); }
  @Post('chatgpt/connect') connectChatGpt(@CurrentUser() user: AuthUser) { return this.chatgpt.start(user.id); }
  @Post('chatgpt/cancel') cancelChatGpt(@CurrentUser() user: AuthUser) { return this.chatgpt.cancel(user.id); }
  @Post('chatgpt/disconnect') disconnectChatGpt(@CurrentUser() user: AuthUser) { return this.chatgpt.disconnect(user.id); }
  @Get('chatgpt/models') chatGptModels(@CurrentUser() user: AuthUser) { return this.chatgpt.models(user.id); }
  @Patch('chatgpt/model') chatGptModel(@CurrentUser() user: AuthUser, @Body() dto: ChatGptModelDto) { return this.chatgpt.selectModel(user.id, dto.model); }

  @Get('claude-code')
  claudeCodeStatus() { return this.claudeCode.status(); }
  @HttpCode(200)
  @Post('claude-code/test')
  testClaude(@CurrentUser() user: AuthUser) {
    return this.ai.complete(user.id, 'connection-test', { provider: 'claude-cli', system: 'Reply with one short Korean sentence.', prompt: '연결 성공이라고 답해주세요.' });
  }

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.ai.status(user.id);
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

import { Global, Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ClaudeCodeService } from './claude-code.service';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { ChatGptService } from './chatgpt.service';
import { GeminiService } from './gemini.service';

@Global()
@Module({
  imports: [AppSettingsModule],
  controllers: [AiController],
  providers: [AiService, ClaudeCodeService, ChatGptService, GeminiService],
  exports: [AiService],
})
export class AiModule {}

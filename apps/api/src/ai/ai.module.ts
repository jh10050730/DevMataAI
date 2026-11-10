import { Global, Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ClaudeCodeService } from './claude-code.service';
import { AppSettingsModule } from '../app-settings/app-settings.module';

@Global()
@Module({
  imports: [AppSettingsModule],
  controllers: [AiController],
  providers: [AiService, ClaudeCodeService],
  exports: [AiService],
})
export class AiModule {}

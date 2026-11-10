import { Global, Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ClaudeCodeService } from './claude-code.service';

@Global()
@Module({
  controllers: [AiController],
  providers: [AiService, ClaudeCodeService],
  exports: [AiService],
})
export class AiModule {}

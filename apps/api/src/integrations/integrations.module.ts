import { Global, Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { NotionService } from './notion.service';

@Global()
@Module({
  controllers: [IntegrationsController],
  providers: [NotionService],
  exports: [NotionService],
})
export class IntegrationsModule {}

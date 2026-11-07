import { Module } from '@nestjs/common';
import { StudyToolsController } from './study-tools.controller';
import { StudyToolsService } from './study-tools.service';

/** 학습 노트의 AI 기능과 Notion 연동 (AiModule, IntegrationsModule 은 전역 모듈) */
@Module({
  controllers: [StudyToolsController],
  providers: [StudyToolsService],
})
export class StudyToolsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { CalendarModule } from './calendar/calendar.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health.controller';
import { StudyModule } from './study/study.module';
import { NewsModule } from './news/news.module';
import { AiModule } from './ai/ai.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { StudyToolsModule } from './study-tools/study-tools.module';
import { ProjectsModule } from './projects/projects.module';
import { AssistantModule } from './assistant/assistant.module';

// Phase 2 이후 추가 예정: Study, Notes, News, Projects, Github, AI, Integrations
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TasksModule,
    CalendarModule,
    DashboardModule,
    StudyModule,
    NewsModule,
    AiModule,
    IntegrationsModule,
    StudyToolsModule,
    ProjectsModule,
    AssistantModule,
  ],
  controllers: [HealthController],
  // 모든 API는 기본적으로 로그인 필요. 예외는 @Public()
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}

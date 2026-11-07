import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { TasksModule } from '../tasks/tasks.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TasksModule, CalendarModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

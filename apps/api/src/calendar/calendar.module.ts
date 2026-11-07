import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

// Google Calendar 연동은 이후 단계에서 이 모듈에 GoogleCalendarService 로 추가 (Event.source = GOOGLE)
@Module({
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}

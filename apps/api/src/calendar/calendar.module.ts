import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { GoogleCalendarController } from './google/google-calendar.controller';
import { GoogleCalendarService } from './google/google-calendar.service';

// Google Calendar: 읽기 전용 단방향 동기화 (Event.source = GOOGLE, externalId = Google 일정 ID)
@Module({
  controllers: [CalendarController, GoogleCalendarController],
  providers: [CalendarService, GoogleCalendarService],
  exports: [CalendarService, GoogleCalendarService],
})
export class CalendarModule {}

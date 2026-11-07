import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { CalendarService } from './calendar.service';
import { CreateEventDto, EventRangeDto, UpdateEventDto } from './events.dto';

@Controller('events')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  /** GET /api/events?from=ISO&to=ISO */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() range: EventRangeDto) {
    return this.calendar.list(user.id, range);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.calendar.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.calendar.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.calendar.remove(user.id, id);
  }
}

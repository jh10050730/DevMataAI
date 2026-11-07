import { Controller, Get, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { EventRangeDto } from '../calendar/events.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** GET /api/dashboard/today?from=로컬자정ISO&to=다음날자정ISO */
  @Get('today')
  today(@CurrentUser() user: AuthUser, @Query() range: EventRangeDto) {
    return this.dashboard.today(user.id, range.from, range.to);
  }
}

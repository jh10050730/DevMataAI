import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { NotificationsService } from './notifications.service';
class NotificationSettingsDto {
  @IsBoolean() notificationInApp: boolean;
  @IsBoolean() notificationEmail: boolean;
}
type AuthRequest = { user: { id: string } };
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() list(@Req() req: AuthRequest) { return this.notifications.list(req.user.id); }
  @Get('settings') settings(@Req() req: AuthRequest) { return this.notifications.settings(req.user.id); }
  @Patch('settings') updateSettings(@Req() req: AuthRequest, @Body() dto: NotificationSettingsDto) { return this.notifications.updateSettings(req.user.id, dto); }
  @Post('read-all') readAll(@Req() req: AuthRequest) { return this.notifications.readAll(req.user.id); }
  @Patch(':id/read') read(@Req() req: AuthRequest, @Param('id') id: string) { return this.notifications.read(req.user.id, id); }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { NotificationsService } from './notifications.service';
class NotificationSettingsDto {
  @IsBoolean() notificationInApp: boolean;
  @IsBoolean() notificationEmail: boolean;
  /** 아침 브리핑 켜기·시각(한국 시간 0~17시) */
  @IsOptional() @IsBoolean() briefingEnabled?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(17) briefingHour?: number;
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
  @Delete() dismissAll(@Req() req: AuthRequest) { return this.notifications.dismissAll(req.user.id); }
  @Delete(':id') dismiss(@Req() req: AuthRequest, @Param('id') id: string) { return this.notifications.dismiss(req.user.id, id); }
}

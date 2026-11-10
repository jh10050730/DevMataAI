import { Body, Controller, Get, Patch } from '@nestjs/common';
import { IsObject } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { AppSettingsService } from './app-settings.service';
class SettingsDto { @IsObject() values: Record<string, unknown>; }
@Controller('app-settings')
export class AppSettingsController {
  constructor(private readonly settings: AppSettingsService) {}
  @Get() read(@CurrentUser() user: AuthUser) { return this.settings.read(user.id); }
  @Patch() update(@CurrentUser() user: AuthUser, @Body() dto: SettingsDto) { return this.settings.update(user.id, dto.values); }
}

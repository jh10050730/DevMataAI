import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { DesktopService, FOLDER_TARGETS, UPDATE_ACTIONS, type FolderTarget, type UpdateAction } from './desktop.service';

class OpenFolderDto {
  @IsIn(FOLDER_TARGETS)
  target: FolderTarget;
}

class UpdateDto {
  @IsIn(UPDATE_ACTIONS)
  action: UpdateAction;
}

@Controller('desktop')
export class DesktopController {
  constructor(private readonly desktop: DesktopService) {}

  /** GET /api/desktop/info — 버전, (데스크톱이면) 데이터·로그 폴더 */
  @Get('info')
  info() {
    return this.desktop.info();
  }

  /** POST /api/desktop/open { target: "data" | "logs" } — 탐색기로 폴더 열기 (관리자만) */
  @Post('open')
  @HttpCode(204)
  async open(@CurrentUser() user: AuthUser, @Body() dto: OpenFolderDto) {
    await this.desktop.open(user.id, dto.target);
  }

  /** POST /api/desktop/update { action: "check" | "install" } — 업데이트 확인·재시작해서 설치 */
  @Post('update')
  @HttpCode(202)
  update(@Body() dto: UpdateDto) {
    this.desktop.requestUpdate(dto.action);
  }
}

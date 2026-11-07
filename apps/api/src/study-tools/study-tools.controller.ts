import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { NotionExportRequestDto, NotionImportRequestDto, StudyAiRequestDto } from './study-tools.dto';
import { StudyToolsService } from './study-tools.service';

@Controller('study')
export class StudyToolsController {
  constructor(private readonly tools: StudyToolsService) {}

  @HttpCode(200)
  @Post('notes/:id/ai')
  ai(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StudyAiRequestDto) {
    return this.tools.runAi(user.id, id, dto);
  }

  @Post('notion/import')
  importNotion(@CurrentUser() user: AuthUser, @Body() dto: NotionImportRequestDto) {
    return this.tools.importFromNotion(user.id, dto);
  }

  @HttpCode(200)
  @Post('notes/:id/notion')
  exportNotion(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: NotionExportRequestDto) {
    return this.tools.exportToNotion(user.id, id, dto);
  }
}

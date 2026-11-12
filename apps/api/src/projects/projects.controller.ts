import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, CreateProjectItemDto, UpdateProjectItemDto, FileQueryDto, DevLogDto } from './projects.dto';
import { DevLogService } from './devlog.service';
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService, private readonly devLogs: DevLogService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.projects.list(u.id); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateProjectDto) { return this.projects.save(u.id, dto); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.projects.owned(u.id, id); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateProjectDto) { return this.projects.save(u.id, dto, id); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.projects.remove(u.id, id); }
  @Post(':id/items') item(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CreateProjectItemDto) { return this.projects.item(u.id, id, dto); }
  @Patch(':id/items/:itemId') updateItem(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateProjectItemDto) { return this.projects.item(u.id, id, dto, itemId); }
  @Delete(':id/items/:itemId') removeItem(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string) { return this.projects.removeItem(u.id, id, itemId); }
  @Get(':id/github') github(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.projects.activity(u.id, id); }
  @Get(':id/reports') reports(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.projects.reports(u.id, id); }
  @Post(':id/reports') report(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.projects.report(u.id, id); }
  @Get(':id/files') files(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query() q: FileQueryDto) { return this.projects.files(u.id, id, q.source); }
  @Get(':id/files/content') file(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query() q: FileQueryDto) { if (!q.path) throw new BadRequestException('path가 필요합니다.'); return this.projects.fileContent(u.id, id, q.source, q.path); }
  @Get(':id/devlogs') devlogs(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.devLogs.list(u.id, id); }
  @Post(':id/devlogs') devlog(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DevLogDto) { return this.devLogs.generate(u.id, id, dto.day); }
  @Delete(':id/devlogs/:logId') removeDevlog(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('logId') logId: string) { return this.devLogs.remove(u.id, id, logId); }
  @Post(':id/analyze') analyze(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.projects.analyze(u.id, id); }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { CreateNoteDto, StudyQueryDto, StudySessionDto, SubjectDto, UpdateNoteDto } from './study.dto';
import { StudyService } from './study.service';

@Controller('study')
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) { return this.study.overview(user.id); }
  @Get('subjects')
  subjects(@CurrentUser() user: AuthUser) { return this.study.subjects(user.id); }
  @Post('subjects')
  createSubject(@CurrentUser() user: AuthUser, @Body() dto: SubjectDto) { return this.study.subject(user.id, dto); }
  @Patch('subjects/:id')
  updateSubject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SubjectDto) { return this.study.subject(user.id, dto, id); }
  @Delete('subjects/:id')
  deleteSubject(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.study.deleteSubject(user.id, id); }
  @Get('notes')
  notes(@CurrentUser() user: AuthUser, @Query() query: StudyQueryDto) {
    return this.study.notes(user.id, query.q, query.subjectId, query.tag, query.due);
  }
  @Get('notes/:id')
  note(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.study.note(user.id, id); }
  @Post('notes')
  createNote(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto) { return this.study.save(user.id, dto); }
  @Patch('notes/:id')
  updateNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateNoteDto) { return this.study.save(user.id, dto, id); }
  @Delete('notes/:id')
  deleteNote(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.study.remove(user.id, id); }
  @Post('notes/:id/studied')
  studied(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StudySessionDto) { return this.study.studied(user.id, id, dto); }
}

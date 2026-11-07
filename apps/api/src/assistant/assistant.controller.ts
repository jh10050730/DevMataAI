import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { AssistantService } from './assistant.service';
import { ActionDto, ChatDto, SearchDto } from './assistant.dto';
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}
  @Get('search') search(@CurrentUser() u: AuthUser, @Query() q: SearchDto) { return this.assistant.search(u.id, q.q); }
  @Get('briefing') briefing(@CurrentUser() u: AuthUser) { return this.assistant.context(u.id); }
  @Get('recommendations/:projectId') recommendations(@CurrentUser() u: AuthUser, @Param('projectId') id: string) { return this.assistant.recommendations(u.id, id); }
  @Post('chat') chat(@CurrentUser() u: AuthUser, @Body() dto: ChatDto) { return this.assistant.chat(u.id, dto); }
  @Post('actions') propose(@CurrentUser() u: AuthUser, @Body() dto: ActionDto) { return this.assistant.propose(u.id, dto); }
  @Post('actions/:id/confirm') confirm(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.assistant.confirm(u.id, id); }
  @Post('actions/:id/cancel') cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.assistant.cancel(u.id, id); }
}

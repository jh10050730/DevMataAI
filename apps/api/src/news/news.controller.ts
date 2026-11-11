import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { NewsService } from './news.service';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
class NewsQuery {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsIn(['IT', 'AI', 'SECURITY', 'DEV', 'TECH', 'ECONOMY', 'FINANCE', 'REAL_ESTATE', 'WORLD', 'POLITICS', 'SOCIETY']) category?: string;
}
@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}
  @Get() list(@Query() query: NewsQuery, @CurrentUser() user: AuthUser) { return this.news.list(query.q, query.category, user.id); }
  @Post('refresh') refresh() { return this.news.refresh(); }
  @Get('schedule') schedule() { return this.news.schedule(); }
  @Get('briefing') briefing(@Query() query: NewsQuery, @CurrentUser() user: AuthUser) { return this.news.briefing(query.category, user.id); }
  @Post('briefing/analyze') analyze(@Query() query: NewsQuery, @CurrentUser() user: AuthUser) { return this.news.analyze(user.id, query.category); }
  @Post(':id/summary') articleSummary(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.news.articleSummary(id, user.id); }
}

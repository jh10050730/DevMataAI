import { Controller, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { BriefingService } from './briefing.service';
@Controller('briefing')
export class BriefingController {
  constructor(private readonly briefing: BriefingService) {}
  /** 설정 화면의 "지금 받아 보기" */
  @Post('preview') preview(@CurrentUser() u: AuthUser) { return this.briefing.preview(u.id); }
}

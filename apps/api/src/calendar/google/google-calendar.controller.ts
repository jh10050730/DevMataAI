import { BadRequestException, Controller, Delete, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../auth/public.decorator';
import { AuthUser, CurrentUser } from '../../common/current-user.decorator';
import { focusDesktop, identityPage, isDesktop, notifyDesktop, returnPage, settingsPath } from './desktop-return';
import { GoogleIdentityService } from '../../auth/google-identity.service';
import { GoogleCalendarService } from './google-calendar.service';

@Controller('google')
export class GoogleCalendarController {
  constructor(private readonly google: GoogleCalendarService, private readonly identity: GoogleIdentityService) {}

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.google.status(user.id);
  }

  /** Google 로그인 주소를 돌려준다. 브라우저가 그 주소로 이동한다. */
  @Post('connect')
  @HttpCode(200)
  connect(@CurrentUser() user: AuthUser) {
    return this.google.authUrl(user.id);
  }

  /**
   * Google → 이 주소로 돌아온다 (로그인 토큰이 없으므로 Public, 대신 서명된 state 로 사용자 확인).
   * 결과는 웹 설정 화면으로 리디렉션해서 알린다.
   */
  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    // 회원가입·비밀번호 찾기·아이디 찾기의 Google 본인 확인 (같은 콜백 주소를 쓴다)
    if (this.identity.owns(state)) {
      const result = await this.identity.callback(code, state, error);
      if (isDesktop()) focusDesktop();
      return res.status(200).type('html').send(identityPage(result.ok, result.message));
    }
    const back = (result: string, reason?: string) => {
      const path = settingsPath(result, reason);
      // 데스크톱 앱: 앱 창을 앞으로 가져오고, 브라우저에는 "앱으로 돌아가세요" 안내
      if (isDesktop() && notifyDesktop(path)) return res.status(200).type('html').send(returnPage(result === 'connected', reason));
      return res.redirect(`${this.google.webOrigin}${path}`);
    };
    if (error) return back('error', error === 'access_denied' ? 'Google 연결을 취소했습니다.' : `Google 오류: ${error}`);
    try {
      await this.google.handleCallback(code, state);
      return back('connected');
    } catch (e) {
      return back('error', e instanceof BadRequestException ? e.message : 'Google 연결 중 오류가 발생했습니다.');
    }
  }

  @Post('sync')
  @HttpCode(200)
  sync(@CurrentUser() user: AuthUser) {
    return this.google.sync(user.id);
  }

  /** DELETE /api/google?removeEvents=true — 연결 해제 (removeEvents: 가져온 사본 일정도 삭제) */
  @Delete()
  disconnect(@CurrentUser() user: AuthUser, @Query('removeEvents') removeEvents?: string) {
    return this.google.disconnect(user.id, removeEvents === 'true');
  }
}

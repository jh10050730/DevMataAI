import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto';
import { PasswordResetService } from './password-reset.service';
import { Public } from './public.decorator';
import { GoogleIdentityService, IDENTITY_PURPOSES, type IdentityPurpose } from './google-identity.service';

class IdentityStartDto {
  @IsIn(IDENTITY_PURPOSES)
  purpose: IdentityPurpose;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly passwords: PasswordResetService, private readonly identity: GoogleIdentityService) {}

  /** Google 본인 확인을 쓸 수 있는지, 가입에 꼭 필요한지 */
  @Public() @Get('google/available')
  googleAvailable() { return { available: this.identity.available, requiredForSignup: this.identity.requiredForSignup }; }

  /** Google 본인 확인 시작: 로그인 주소와 결과를 물을 requestId */
  @Public() @HttpCode(200) @Post('google/start')
  googleStart(@Body() dto: IdentityStartDto) { return this.identity.start(dto.purpose); }

  /** 본인 확인 결과 (끝난 결과는 한 번만) */
  @Public() @Get('google/result/:requestId')
  googleResult(@Param('requestId') requestId: string) { return this.identity.result(requestId); }

  @Public() @HttpCode(200) @Post('forgot-password')
  forgot(@Body() dto: ForgotPasswordDto, @Req() req: Request) { return this.passwords.request(dto.email, req.ip ?? 'unknown'); }

  @Public() @HttpCode(200) @Post('reset-password')
  reset(@Body() dto: ResetPasswordDto, @Req() req: Request) { return this.passwords.reset(dto, req.ip ?? 'unknown'); }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}

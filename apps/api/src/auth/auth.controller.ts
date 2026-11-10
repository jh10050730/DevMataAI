import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto';
import { PasswordResetService } from './password-reset.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly passwords: PasswordResetService) {}

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

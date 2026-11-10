import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72) throw new BadRequestException('비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.');
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('이미 가입된 이메일입니다.');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.create({ email: dto.email, name: dto.name, passwordHash });
    return this.issueToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    // 이메일 존재 여부가 드러나지 않도록 같은 메시지 사용
    const ok = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !ok) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    return this.issueToken(user);
  }

  private async issueToken(user: { id: string; email: string; name: string; createdAt: Date; sessionVersion: number }) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, version: user.sessionVersion });
    return { accessToken, user: UsersService.toPublic(user) };
  }
}

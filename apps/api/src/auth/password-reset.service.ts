import { BadRequestException, HttpException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ResetPasswordDto } from './auth.dto';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const INVALID = '링크가 만료되었거나 이미 사용되었습니다. 재설정 메일을 다시 요청해 주세요.';
@Injectable()
export class PasswordResetService {
  private limits = new Map<string, { count: number; expires: number }>();
  constructor(private readonly db: PrismaService, private readonly mail: MailService) {}
  private limit(key: string, maximum: number) {
    const now = Date.now();
    for (const [id, value] of this.limits) if (value.expires <= now) this.limits.delete(id);
    const entry = this.limits.get(key) ?? { count: 0, expires: now + 15 * 60000 };
    if (entry.count >= maximum || (!this.limits.has(key) && this.limits.size >= 5000)) throw new HttpException('요청이 너무 많습니다. 15분 후 다시 시도해 주세요.', 429);
    entry.count++; this.limits.set(key, entry);
  }
  async request(email: string, ip: string) {
    this.limit('request:' + ip, 30); this.limit('email:' + hash(email), 3);
    this.mail.assertConfigured();
    const url = this.mail.publicUrl('/reset-password');
    const user = await this.db.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString('hex');
      const resetTokenHash = hash(token);
      await this.db.user.update({ where: { id: user.id }, data: { resetTokenHash, resetTokenExpiresAt: new Date(Date.now() + 15 * 60000) } });
      // Fragment keeps the token out of HTTP URL logs and referrers.
      url.hash = 'token=' + token;
      // Dispatch asynchronously so SMTP latency does not expose whether an account exists.
      void this.mail.send(email, '[DevMata] 비밀번호 재설정', `비밀번호를 바꾸려면 아래 링크를 열어 주세요.\n\n${url.href}\n\n15분 동안 한 번만 사용할 수 있습니다. 요청하지 않았다면 이 메일을 무시해 주세요.`).catch(async () => {
        Logger.warn('비밀번호 재설정 메일 발송 실패. SMTP 설정을 확인하세요.', 'PasswordReset');
        await this.db.user.updateMany({ where: { id: user.id, resetTokenHash }, data: { resetTokenHash: null, resetTokenExpiresAt: null } }).catch(() => {});
      });
    }
    return { message: '가입된 이메일이라면 재설정 링크가 발송됩니다. 메일함과 스팸함을 확인해 주세요.' };
  }
  async reset(dto: ResetPasswordDto, ip: string) {
    this.limit('reset:' + ip, 30);
    if (dto.password !== dto.passwordConfirmation) throw new BadRequestException('비밀번호가 일치하지 않습니다.');
    if (Buffer.byteLength(dto.password, 'utf8') > 72) throw new BadRequestException('비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.');
    const resetTokenHash = hash(dto.token);
    const user = await this.db.user.findUnique({ where: { resetTokenHash } });
    if (!user?.resetTokenExpiresAt || user.resetTokenExpiresAt <= new Date()) throw new BadRequestException(INVALID);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const updated = await this.db.user.updateMany({ where: { id: user.id, resetTokenHash, resetTokenExpiresAt: { gt: new Date() }, sessionVersion: user.sessionVersion }, data: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null, sessionVersion: { increment: 1 } } });
    if (updated.count !== 1) throw new BadRequestException(INVALID);
    return { message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.' };
  }
}

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}
  get configured() { return ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'].every(key => !!this.config.get<string>(key)?.trim()); }
  assertConfigured() {
    if (!this.configured) throw new ServiceUnavailableException('이메일 발송 설정이 아직 완료되지 않았습니다. 관리자에게 문의해 주세요.');
  }
  publicUrl(path: string) {
    const base = new URL(this.config.get<string>('WEB_ORIGIN', 'http://localhost:5173'));
    if (base.username || base.password || !['http:', 'https:'].includes(base.protocol) || (base.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) throw new ServiceUnavailableException('메일 링크 주소 설정을 확인해 주세요.');
    return new URL(path, base.origin);
  }
  async send(to: string, subject: string, text: string) {
    this.assertConfigured();
    const port = Number(this.config.get('SMTP_PORT', '587'));
    const transport = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'), port,
      secure: port === 465, requireTLS: port !== 465,
      auth: { user: this.config.getOrThrow<string>('SMTP_USER'), pass: this.config.getOrThrow<string>('SMTP_PASSWORD') },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    try {
      const result = await transport.sendMail({ from: this.config.getOrThrow<string>('SMTP_FROM'), to, subject, text });
      if (!result.accepted.length) throw new Error('Mail not accepted');
    } finally { transport.close(); }
  }
}

import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';

describe('password recovery and email validation', () => {
  let app: INestApplication;
  let serial = 0;
  const mail = { configured: true, assertConfigured: () => { if (!mail.configured) throw new ServiceUnavailableException('메일 설정 필요'); }, publicUrl: (path: string) => new URL(path, 'http://localhost:5173'), send: jest.fn().mockResolvedValue(undefined) };
  const api = () => request(app.getHttpServer());
  const db = () => app.get(PrismaService);
  const create = async () => { const email = `recovery-${++serial}@gmail.com`; const result = await api().post('/api/auth/register').send({ email, name: '검증', password: 'original-password' }).expect(201); return { email, ...result.body }; };
  const ask = async (email: string) => {
    await api().post('/api/auth/forgot-password').set('Host', 'attacker.example').send({ email }).expect(200);
    const text = mail.send.mock.calls.at(-1)![2] as string;
    expect(text).toContain('http://localhost:5173/reset-password#token=');
    return /token=([a-f0-9]{64})/.exec(text)![1];
  };
  const reset = (token: string, password = 'new-secure-password') => api().post('/api/auth/reset-password').send({ token, password, passwordConfirmation: password });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(MailService).useValue(mail).compile();
    app = module.createNestApplication(); configureApp(app); await app.init();
  });
  afterAll(async () => { await db().user.deleteMany({ where: { email: { startsWith: 'recovery-' } } }); await app.close(); });
  beforeEach(() => { mail.configured = true; mail.send.mockReset().mockResolvedValue(undefined); });
  it.each(['gmali.com', 'gamil.com', 'naver.con', 'gmail.comm'])('오타 도메인 %s 가입·재설정 차단', async domain => {
    await api().post('/api/auth/register').send({ email: `typo@${domain}`, name: '검증', password: 'password123' }).expect(400);
    await api().post('/api/auth/forgot-password').send({ email: `typo@${domain}` }).expect(400);
  });
  it('등록되지 않은 이메일도 같은 응답이며 메일·토큰을 생성하지 않음', async () => {
    const account = await create();
    const known = await api().post('/api/auth/forgot-password').send({ email: account.email }).expect(200);
    const unknown = await api().post('/api/auth/forgot-password').send({ email: 'recovery-absent@gmail.com' }).expect(200);
    expect(unknown.body).toEqual(known.body);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(known.body.token).toBeUndefined();
  });
  it('토큰 해시 보관, 비밀번호 변경, 이전 로그인과 토큰 재사용 차단', async () => {
    const account = await create(); const token = await ask(account.email);
    const stored = await db().user.findUniqueOrThrow({ where: { email: account.email } });
    expect(stored.resetTokenHash).toHaveLength(64); expect(stored.resetTokenHash).not.toBe(token);
    await reset(token).expect(200); await reset(token).expect(400);
    await api().get('/api/users/me').set('Authorization', `Bearer ${account.accessToken}`).expect(401);
    await api().post('/api/auth/login').send({ email: account.email, password: 'original-password' }).expect(401);
    await api().post('/api/auth/login').send({ email: account.email, password: 'new-secure-password' }).expect(200);
    expect((await db().user.findUniqueOrThrow({ where: { email: account.email } })).resetTokenHash).toBeNull();
  });
  it('재발급하면 이전 링크 무효, 비밀번호 불일치·만료 차단', async () => {
    const account = await create(); const old = await ask(account.email); const token = await ask(account.email);
    await reset(old).expect(400);
    await api().post('/api/auth/reset-password').send({ token, password: 'password123', passwordConfirmation: 'different123' }).expect(400);
    await db().user.update({ where: { email: account.email }, data: { resetTokenExpiresAt: new Date(0) } });
    await reset(token).expect(400);
  });
  it('동시에 같은 링크를 써도 한 번만 변경', async () => {
    const account = await create(); const token = await ask(account.email);
    const results = await Promise.all([reset(token), reset(token, 'another-password')]);
    expect(results.map(result => result.status).sort()).toEqual([200, 400]);
  });
  it('메일 미설정은 성공 메시지 대신 503, 과도한 재요청은 제한', async () => {
    mail.configured = false;
    await api().post('/api/auth/forgot-password').send({ email: 'recovery-disabled@gmail.com' }).expect(503);
    mail.configured = true;
    for (let i = 0; i < 3; i++) await api().post('/api/auth/forgot-password').send({ email: 'recovery-limit@gmail.com' }).expect(200);
    await api().post('/api/auth/forgot-password').send({ email: 'recovery-limit@gmail.com' }).expect(429);
  });
});

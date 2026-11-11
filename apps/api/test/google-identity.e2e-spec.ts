import './google-env'; // 반드시 AppModule 보다 먼저
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { readIdToken } from '../src/auth/google-identity.service';

/**
 * Google 본인 확인 (회원가입·비밀번호 찾기·아이디 찾기). Google 은 부르지 않고 fetch 를 가짜 응답으로 바꾼다.
 */
const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const idToken = (claims: object) => ['x', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'y'].join('.');
const claimsFor = (email: string, extra: object = {}) => ({
  aud: CLIENT_ID, iss: 'https://accounts.google.com', exp: Math.floor(Date.now() / 1000) + 3600, email, email_verified: true, name: '구글 사용자', ...extra,
});

describe('readIdToken', () => {
  const now = Date.now();
  it('aud·iss·exp·email_verified 를 확인하고 이메일을 소문자로', () => {
    expect(readIdToken(idToken(claimsFor('Me@Gmail.com')), CLIENT_ID, now)).toEqual({ email: 'me@gmail.com', name: '구글 사용자' });
    expect(readIdToken(idToken(claimsFor('me@gmail.com', { iss: 'accounts.google.com', email_verified: 'true' })), CLIENT_ID, now)).not.toBeNull();
  });
  it.each([
    ['다른 앱', { aud: 'other' }],
    ['다른 발급자', { iss: 'https://evil.example' }],
    ['만료', { exp: Math.floor(now / 1000) - 10 }],
    ['미확인 이메일', { email_verified: false }],
    ['이메일 없음', { email: undefined }],
  ])('%s → null', (_name, extra) => {
    expect(readIdToken(idToken(claimsFor('me@gmail.com', extra)), CLIENT_ID, now)).toBeNull();
  });
  it('형식이 깨진 토큰 → null', () => {
    expect(readIdToken(undefined, CLIENT_ID)).toBeNull();
    expect(readIdToken('abc', CLIENT_ID)).toBeNull();
  });
});

describe('Google 본인 확인 (e2e)', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  const realFetch = global.fetch;
  let nextClaims: object = {};
  let tokenStatus = 200;
  const bodies: string[] = [];
  const stamp = Date.now();
  const existing = `identity-${stamp}@gmail.com`;

  beforeAll(async () => {
    global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        bodies.push(String(init?.body ?? ''));
        return new Response(JSON.stringify(tokenStatus === 200 ? { access_token: 'ya29', id_token: idToken(nextClaims) } : { error: 'invalid_grant' }), { status: tokenStatus, headers: { 'Content-Type': 'application/json' } });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    await api().post('/api/auth/register').send({ email: existing, name: '기존', password: 'password123' }).expect(201);
  });

  afterAll(async () => {
    global.fetch = realFetch;
    delete process.env.DEVMATA_DESKTOP;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    await app.close();
  });

  afterEach(() => { delete process.env.DEVMATA_DESKTOP; tokenStatus = 200; });

  /** start → (Google 로그인 대신) 콜백 → 결과 */
  const verify = async (purpose: string, email: string, extra: object = {}) => {
    const start = await api().post('/api/auth/google/start').send({ purpose }).expect(200);
    const url = new URL(start.body.url);
    nextClaims = claimsFor(email, extra);
    const callback = await api().get('/api/google/callback').query({ code: 'CODE', state: url.searchParams.get('state') }).expect(200);
    const result = await api().get(`/api/auth/google/result/${start.body.requestId}`).expect(200);
    return { start, url, callback, result: result.body };
  };

  it('사용 가능 여부: 키가 있으면 available, 가입 필수는 데스크톱 앱에서만', async () => {
    expect((await api().get('/api/auth/google/available').expect(200)).body).toEqual({ available: true, requiredForSignup: false });
    process.env.DEVMATA_DESKTOP = '1';
    expect((await api().get('/api/auth/google/available').expect(200)).body).toEqual({ available: true, requiredForSignup: true });
  });

  it('시작: 이메일·프로필만 요청하고 PKCE·계정 선택을 쓴다', async () => {
    const start = await api().post('/api/auth/google/start').send({ purpose: 'find' }).expect(200);
    const url = new URL(start.body.url);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('prompt')).toBe('select_account');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(start.body.requestId).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    // 끝나기 전에는 pending
    expect((await api().get(`/api/auth/google/result/${start.body.requestId}`).expect(200)).body).toEqual({ status: 'pending' });
    await api().post('/api/auth/google/start').send({ purpose: 'login' }).expect(400);
  });

  it('아이디 찾기: 가입된 이메일인지 알려 주고, 결과는 한 번만 받을 수 있다', async () => {
    const { start, callback, result } = await verify('find', existing.toUpperCase());
    expect(callback.text).toContain('Google 본인 확인 완료');
    expect(result).toMatchObject({ status: 'done', purpose: 'find', email: existing, exists: true });
    expect(result.ticket).toBeUndefined();
    expect(bodies.at(-1)).toContain('code_verifier=');
    await api().get(`/api/auth/google/result/${start.body.requestId}`).expect(404);

    const none = await verify('find', `nobody-${stamp}@gmail.com`);
    expect(none.result).toMatchObject({ status: 'done', exists: false });
  });

  it('회원가입: 확인 표로 확인한 이메일만 가입, 표는 한 번만', async () => {
    const email = `signup-${stamp}@gmail.com`;
    process.env.DEVMATA_DESKTOP = '1';
    const { result } = await verify('signup', email);
    expect(result).toMatchObject({ status: 'done', exists: false, name: '구글 사용자' });
    expect(typeof result.ticket).toBe('string');

    // 데스크톱 앱에서는 표 없이 가입할 수 없다
    const noTicket = await api().post('/api/auth/register').send({ email: `free-${stamp}@gmail.com`, name: 'X', password: 'password123' }).expect(400);
    expect(noTicket.body.message).toContain('Google 확인');
    // 다른 이메일로는 못 쓴다 (실패해도 표는 쓴 것으로 친다)
    const other = await verify('signup', email);
    await api().post('/api/auth/register').send({ email: `other-${stamp}@gmail.com`, name: 'X', password: 'password123', googleTicket: other.result.ticket }).expect(400);
    await api().post('/api/auth/register').send({ email, name: 'X', password: 'password123', googleTicket: other.result.ticket }).expect(400);

    await api().post('/api/auth/register').send({ email, name: '새 사용자', password: 'password123', googleTicket: result.ticket }).expect(201);
    await api().post('/api/auth/register').send({ email: `again-${stamp}@gmail.com`, name: 'X', password: 'password123', googleTicket: result.ticket }).expect(400);

    // 이미 가입된 이메일이면 표 대신 exists
    const again = await verify('signup', email);
    expect(again.result).toMatchObject({ exists: true });
    expect(again.result.ticket).toBeUndefined();
  });

  it('개발 서버(데스크톱 아님)에서는 예전처럼 표 없이 가입할 수 있다', async () => {
    await api().post('/api/auth/register').send({ email: `web-${stamp}@test.com`, name: 'W', password: 'password123' }).expect(201);
  });

  it('비밀번호 찾기: 확인하면 재설정 주소를 받고, 그 주소로 바꿀 수 있다', async () => {
    const { result } = await verify('reset', existing);
    expect(result).toMatchObject({ status: 'done', exists: true });
    const token = /#token=([a-f0-9]+)$/.exec(result.resetPath)?.[1];
    expect(token).toBeTruthy();
    await api().post('/api/auth/reset-password').send({ token, password: 'brand-new-pass', passwordConfirmation: 'brand-new-pass' }).expect(200);
    await api().post('/api/auth/login').send({ email: existing, password: 'brand-new-pass' }).expect(200);

    const none = await verify('reset', `nobody-${stamp}@gmail.com`);
    expect(none.result).toMatchObject({ exists: false });
    expect(none.result.resetPath).toBeUndefined();
  });

  it('실패: 취소·미확인 이메일·토큰 오류는 오류 결과로, 위조 state 는 만료 안내', async () => {
    const start = await api().post('/api/auth/google/start').send({ purpose: 'find' }).expect(200);
    const state = new URL(start.body.url).searchParams.get('state');
    const cancelled = await api().get('/api/google/callback').query({ error: 'access_denied', state }).expect(200);
    expect(cancelled.text).toContain('Google 본인 확인 실패');
    expect((await api().get(`/api/auth/google/result/${start.body.requestId}`).expect(200)).body).toEqual({ status: 'error', message: 'Google 확인을 취소했어요.' });

    const unverified = await verify('find', existing, { email_verified: false });
    expect(unverified.result).toMatchObject({ status: 'error' });

    tokenStatus = 400;
    const bad = await verify('find', existing);
    expect(bad.result).toEqual({ status: 'error', message: 'Google 확인에 실패했어요. 다시 시도해 주세요.' });

    await api().get('/api/auth/google/result/not-a-real-request').expect(404);
  });

  it('메시지는 HTML 로 이스케이프된다', async () => {
    const start = await api().post('/api/auth/google/start').send({ purpose: 'find' }).expect(200);
    const state = new URL(start.body.url).searchParams.get('state');
    const res = await api().get('/api/google/callback').query({ error: '<script>x</script>', state }).expect(200);
    expect(res.text).not.toContain('<script>x');
    expect(res.text).toContain('&lt;script&gt;');
  });
});

import './google-env'; // 반드시 AppModule 보다 먼저
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { signState } from '../src/calendar/google/google-crypto';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Google Calendar 연동. 실제 Google 은 호출하지 않고 fetch 를 가짜 응답으로 바꾼다.
 * 확인: 미설정 안내, state 검증, 토큰 암호화 저장, 단방향 동기화, 가져온 일정 읽기 전용, 연결 해제.
 */
describe('Google Calendar (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const realFetch = global.fetch;
  const calls: string[] = [];
  let googleEvents: object[] = [];

  beforeAll(async () => {
    global.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url.split('?')[0]);
      const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      if (url.startsWith('https://oauth2.googleapis.com/token')) {
        const idToken = ['x', Buffer.from(JSON.stringify({ email: 'me@gmail.com' })).toString('base64url'), 'y'].join('.');
        return json({ access_token: 'ya29.ACCESS', refresh_token: '1//REFRESH', expires_in: 3600, scope: 'openid email https://www.googleapis.com/auth/calendar.readonly', id_token: idToken });
      }
      if (url.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events')) return json({ items: googleEvents });
      if (url.startsWith('https://oauth2.googleapis.com/revoke')) return new Response('', { status: 200 });
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const res = await api().post('/api/auth/register').send({ email: `google-${Date.now()}@test.com`, name: 'G', password: 'password123' });
    token = res.body.accessToken;
    userId = res.body.user.id;
  });

  afterAll(async () => {
    global.fetch = realFetch;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    await app.close();
  });

  const soon = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

  it('연결 전: 상태는 미연결, 동기화는 안내와 함께 400', async () => {
    const s = await api().get('/api/google/status').set(auth()).expect(200);
    expect(s.body).toMatchObject({ configured: true, connected: false, readOnly: true, desktop: false, syncWindow: { pastDays: 30, futureDays: 180 } });
    const sync = await api().post('/api/google/sync').set(auth()).expect(400);
    expect(sync.body.message).toContain('연결되지 않았습니다');
  });

  it('connect: 읽기 전용 권한만 요청하는 Google 로그인 주소', async () => {
    const res = await api().post('/api/google/connect').set(auth()).expect(200);
    const url = new URL(res.body.url);
    expect(url.host).toBe('accounts.google.com');
    expect(url.searchParams.get('scope')).toContain('calendar.readonly');
    expect(url.searchParams.get('scope')).not.toMatch(/auth\/calendar(\s|$)|calendar\.events(?!\.readonly)/);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('state')).toBeTruthy();
    // PKCE: S256 방식의 43자 base64url challenge
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('callback: 위조/누락 state 는 연결하지 않고 오류로 리디렉션', async () => {
    const res = await api().get('/api/google/callback').query({ code: 'c', state: 'forged.sig' }).expect(302);
    expect(res.headers.location).toContain('/settings?google=error');
    await api().get('/api/google/callback').query({ error: 'access_denied' }).expect(302);
    const s = await api().get('/api/google/status').set(auth()).expect(200);
    expect(s.body.connected).toBe(false);
  });

  it('callback: 올바른 state → 토큰을 암호화해 저장하고 설정 화면으로', async () => {
    const state = signState(userId, process.env.JWT_SECRET!);
    const res = await api().get('/api/google/callback').query({ code: 'auth-code', state }).expect(302);
    expect(res.headers.location).toMatch(/\/settings\?google=connected$/);

    const row = await prisma.integration.findUnique({ where: { userId_provider: { userId, provider: 'GOOGLE_CALENDAR' } } });
    expect(row?.status).toBe('CONNECTED');
    expect(row?.accessToken).not.toContain('ya29');
    expect(row?.refreshToken).not.toContain('REFRESH');

    const s = await api().get('/api/google/status').set(auth()).expect(200);
    expect(s.body).toMatchObject({ connected: true, email: 'me@gmail.com' });
    expect(JSON.stringify(s.body)).not.toMatch(/ya29|REFRESH/);
  });

  it('sync: 가져오기 → 갱신 → Google 에서 삭제된 일정은 사본만 정리, Google 에는 GET 만', async () => {
    googleEvents = [
      { id: 'g1', summary: '팀 회의', start: { dateTime: soon(24) }, end: { dateTime: soon(25) } },
      { id: 'g2', summary: '휴가', start: { date: '2026-12-24' }, end: { date: '2026-12-26' } },
      { id: 'g3', status: 'cancelled' },
    ];
    calls.length = 0;
    const first = await api().post('/api/google/sync').set(auth()).expect(200);
    expect(first.body).toMatchObject({ created: 2, updated: 0, removed: 0, total: 2, complete: true });
    expect(calls.every((u) => u.startsWith('https://www.googleapis.com/calendar/v3/calendars/primary/events'))).toBe(true);

    googleEvents = [{ id: 'g1', summary: '팀 회의 (변경)', start: { dateTime: soon(24) }, end: { dateTime: soon(26) } }];
    const second = await api().post('/api/google/sync').set(auth()).expect(200);
    expect(second.body).toMatchObject({ created: 0, updated: 1, removed: 1, total: 1 });

    const events = await prisma.event.findMany({ where: { userId, source: 'GOOGLE' } });
    expect(events.map((e) => e.title)).toEqual(['팀 회의 (변경)']);
  });

  it('가져온 일정은 수정·삭제 불가, 직접 만든 일정은 그대로 가능', async () => {
    const g = await prisma.event.findFirstOrThrow({ where: { userId, source: 'GOOGLE' } });
    await api().patch(`/api/events/${g.id}`).set(auth()).send({ title: 'x' }).expect(400);
    await api().delete(`/api/events/${g.id}`).set(auth()).expect(400);

    const local = await api().post('/api/events').set(auth()).send({ title: '내 일정', startAt: soon(1), endAt: soon(2) }).expect(201);
    expect(local.body.source).toBe('LOCAL');
    await api().patch(`/api/events/${local.body.id}`).set(auth()).send({ title: '내 일정2' }).expect(200);
    await api().delete(`/api/events/${local.body.id}`).set(auth()).expect(200);
  });

  it('연결 해제: 토큰 삭제 + 권한 철회, removeEvents=true 면 사본 일정도 삭제', async () => {
    calls.length = 0;
    const res = await api().delete('/api/google').query({ removeEvents: 'true' }).set(auth()).expect(200);
    expect(res.body).toMatchObject({ disconnected: true, revoked: true, removedEvents: 1 });
    expect(calls).toEqual(['https://oauth2.googleapis.com/revoke']);
    expect(await prisma.integration.count({ where: { userId } })).toBe(0);
    const s = await api().get('/api/google/status').set(auth()).expect(200);
    expect(s.body).toMatchObject({ connected: false, syncedEvents: 0 });
  });
});

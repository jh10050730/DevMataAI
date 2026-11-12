import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiService } from '../src/ai/ai.service';

describe('assistant calendar actions', () => {
  let app: INestApplication; let db: PrismaService;
  let a: { user: { id: string }; accessToken: string }, b: typeof a;
  const ai = { complete: jest.fn() };
  const api = () => request(app.getHttpServer());
  const auth = (user = a) => ({ Authorization: `Bearer ${user.accessToken}` });
  const event = { kind: 'event_create', targetId: 'new', title: '팀 회의', startAt: '2030-11-12T14:00:00+09:00', endAt: '2030-11-12T15:00:00+09:00', location: '회의실', description: '진행 상황 공유', allDay: false };
  const propose = (body: object) => api().post('/api/assistant/actions').set(auth()).send(body);
  const confirm = (id: string) => api().post(`/api/assistant/actions/${id}/confirm`).set(auth());
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(AiService).useValue(ai).compile();
    app = module.createNestApplication(); configureApp(app); await app.init(); db = app.get(PrismaService);
    await db.user.deleteMany();
    a = (await api().post('/api/auth/register').send({ email: 'calendar-a@test.com', name: 'A', password: 'password123' }).expect(201)).body;
    b = (await api().post('/api/auth/register').send({ email: 'calendar-b@test.com', name: 'B', password: 'password123' }).expect(201)).body;
  });
  afterAll(async () => { await db.user.deleteMany(); await app.close(); });
  beforeEach(async () => { ai.complete.mockReset(); await db.event.deleteMany(); await db.assistantAction.deleteMany(); });
  it('previews addition, requires the owner to confirm, and creates exactly once', async () => {
    await api().post('/api/assistant/actions').send(event).expect(401);
    const proposal = (await propose(event).expect(201)).body;
    expect(JSON.parse(proposal.payload)).toMatchObject({ title: '팀 회의', startAt: '2030-11-12T05:00:00.000Z', endAt: '2030-11-12T06:00:00.000Z' });
    expect(await db.event.count()).toBe(0);
    await api().post(`/api/assistant/actions/${proposal.id}/confirm`).set(auth(b)).expect(404);
    const applied = (await confirm(proposal.id).expect(201)).body;
    expect(await db.event.findUniqueOrThrow({ where: { id: applied.targetId } })).toMatchObject({ userId: a.user.id, source: 'LOCAL', title: event.title, location: event.location, description: event.description, allDay: false });
    await confirm(proposal.id).expect(409); expect(await db.event.count()).toBe(1);
  });
  it('never creates cancelled or expired proposals', async () => {
    const cancelled = (await propose(event).expect(201)).body;
    await api().post(`/api/assistant/actions/${cancelled.id}/cancel`).set(auth()).expect(201);
    await confirm(cancelled.id).expect(409);
    const expired = (await propose(event).expect(201)).body;
    await db.assistantAction.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await confirm(expired.id).expect(409); expect(await db.event.count()).toBe(0);
  });
  it('rejects missing, reversed, impossible and timezone-free dates and oversized details', async () => {
    for (const patch of [{ title: ' ' }, { startAt: undefined }, { endAt: undefined }, { endAt: event.startAt }, { endAt: '2030-11-11T01:00:00Z' }, { startAt: '2030-02-30T14:00:00+09:00' }, { startAt: '2030-11-12T14:00:00' }, { allDay: 'false' }, { description: 'x'.repeat(5001) }, { location: 'x'.repeat(201) }, { targetId: a.user.id }]) await propose({ ...event, ...patch }).expect(400);
    expect(await db.assistantAction.count()).toBe(0);
  });
  it('supports all-day events with the end date excluded and validates Korean midnight', async () => {
    const body = { ...event, allDay: true, startAt: '2030-11-12T00:00:00+09:00', endAt: '2030-11-14T00:00:00+09:00' };
    const proposal = (await propose(body).expect(201)).body;
    const applied = (await confirm(proposal.id).expect(201)).body;
    const saved = await db.event.findUniqueOrThrow({ where: { id: applied.targetId } });
    expect(saved.allDay).toBe(true); expect(saved.startAt.toISOString()).toBe('2030-11-11T15:00:00.000Z'); expect(+saved.endAt - +saved.startAt).toBe(2 * 86400000);
    await propose({ ...body, startAt: event.startAt }).expect(400);
  });
  it('previews the exact deletion target, rejects other users and changed or Google events', async () => {
    const local = await db.event.create({ data: { userId: a.user.id, title: '같은 제목', startAt: new Date(event.startAt), endAt: new Date(event.endAt) } });
    const body = { kind: 'event_delete', targetId: local.id };
    await api().post('/api/assistant/actions').set(auth(b)).send(body).expect(404);
    const proposal = (await propose(body).expect(201)).body;
    expect(JSON.parse(proposal.payload)).toMatchObject({ startAt: local.startAt.toISOString(), endAt: local.endAt.toISOString() });
    expect(await db.event.findUnique({ where: { id: local.id } })).not.toBeNull();
    await db.event.update({ where: { id: local.id }, data: { title: '바뀐 제목', updatedAt: new Date(+local.updatedAt + 1000) } });
    await confirm(proposal.id).expect(409);
    const next = (await propose(body).expect(201)).body;
    await confirm(next.id).expect(201); expect(await db.event.findUnique({ where: { id: local.id } })).toBeNull();
    const google = await db.event.create({ data: { userId: a.user.id, title: 'Google 회의', source: 'GOOGLE', startAt: new Date(event.startAt), endAt: new Date(event.endAt) } });
    await propose({ kind: 'event_delete', targetId: google.id }).expect(400);
  });
  it.each(['chatgpt', 'claude-cli'])('uses %s chat proposals to add and delete calendar events', async provider => {
    const existing = await db.event.create({ data: { userId: a.user.id, title: '내일 회의', startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 90000000) } });
    ai.complete.mockResolvedValue({ provider, demo: false, text: JSON.stringify({ answer: '일정 추가와 삭제를 제안했습니다. 내용을 확인해 주세요.', actions: [event, { kind: 'event_delete', targetId: existing.id }] }) });
    const result = await api().post('/api/assistant/chat').set(auth()).send({ message: '2030년 11월 12일 오후 2시부터 3시까지 팀 회의를 추가하고 내일 회의는 삭제해줘.' }).expect(201);
    expect(result.body.actions.map((action: { kind: string }) => action.kind)).toEqual(['event_create', 'event_delete']);
    const context = JSON.parse(ai.complete.mock.calls[0][2].prompt).context;
    expect(context.upcomingEvents.some((item: { id: string }) => item.id === existing.id)).toBe(true);
    expect(ai.complete).toHaveBeenCalledWith(a.user.id, 'assistant:chat', expect.any(Object));
    expect(await db.event.count()).toBe(1);
    for (const action of result.body.actions) await confirm(action.id).expect(201);
    expect(await db.event.findUnique({ where: { id: existing.id } })).toBeNull();
    expect((await db.event.findMany())[0].title).toBe('팀 회의');
  });
  it('does not propose invalid model dates or a foreign deletion target', async () => {
    const foreign = await db.event.create({ data: { userId: b.user.id, title: '비공개 일정', startAt: new Date(), endAt: new Date(Date.now() + 3600000) } });
    ai.complete.mockResolvedValue({ provider: 'chatgpt', demo: false, text: JSON.stringify({ answer: '날짜와 시간을 확인해 주세요.', actions: [{ ...event, endAt: undefined }, { ...event, allDay: 'false' }, { kind: 'event_delete', targetId: foreign.id }] }) });
    expect((await api().post('/api/assistant/chat').set(auth()).send({ message: '일정을 정리해줘.' }).expect(201)).body.actions).toEqual([]);
    expect(await db.assistantAction.count()).toBe(0); expect(await db.event.count()).toBe(1);
  });
});

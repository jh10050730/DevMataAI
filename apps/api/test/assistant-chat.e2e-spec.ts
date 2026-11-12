import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiService } from '../src/ai/ai.service';

/**
 * AI 비서: 대화 저장(새 채팅 전까지 유지), 제안 개수 제한 없음, 할 일·일정·학습 노트 추가·수정 제안.
 * 모든 변경은 여전히 사용자가 확인해야 적용된다.
 */
describe('assistant chat & actions', () => {
  let app: INestApplication; let db: PrismaService;
  let a: { user: { id: string }; accessToken: string }, b: typeof a;
  const ai = { complete: jest.fn() };
  const api = () => request(app.getHttpServer());
  const auth = (user = a) => ({ Authorization: `Bearer ${user.accessToken}` });
  const stamp = Date.now();
  const reply = (answer: string, actions: object[] = []) => ai.complete.mockResolvedValueOnce({ provider: 'claude-cli', demo: false, text: JSON.stringify({ answer, actions }) });
  const propose = (body: object) => api().post('/api/assistant/actions').set(auth()).send(body);
  const confirm = (id: string) => api().post(`/api/assistant/actions/${id}/confirm`).set(auth());

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(AiService).useValue(ai).compile();
    app = module.createNestApplication(); configureApp(app); await app.init(); db = app.get(PrismaService);
    a = (await api().post('/api/auth/register').send({ email: `chat-a-${stamp}@test.com`, name: 'A', password: 'password123' }).expect(201)).body;
    b = (await api().post('/api/auth/register').send({ email: `chat-b-${stamp}@test.com`, name: 'B', password: 'password123' }).expect(201)).body;
  });
  afterAll(async () => { await db.user.deleteMany({ where: { id: { in: [a.user.id, b.user.id] } } }); await app.close(); });
  beforeEach(() => ai.complete.mockReset());

  it('대화는 저장되고, 다음 질문의 이전 대화로 쓰이며, 새 채팅으로만 지워진다', async () => {
    await api().get('/api/assistant/messages').expect(401);
    reply('안녕하세요!');
    await api().post('/api/assistant/chat').set(auth()).send({ message: '안녕' }).expect(201);
    reply('React 는 UI 라이브러리예요.');
    await api().post('/api/assistant/chat').set(auth()).send({ message: 'React 가 뭐야?', page: '/calendar' }).expect(201);

    const rows = (await api().get('/api/assistant/messages').set(auth()).expect(200)).body;
    expect(rows.map((m: { role: string; content: string }) => [m.role, m.content])).toEqual([['user', '안녕'], ['assistant', '안녕하세요!'], ['user', 'React 가 뭐야?'], ['assistant', 'React 는 UI 라이브러리예요.']]);
    // 두 번째 질문에는 저장된 앞 대화와 지금 화면이 함께 간다
    const prompt = JSON.parse(ai.complete.mock.calls[1][2].prompt);
    expect(prompt.history).toEqual([{ role: 'user', content: '안녕' }, { role: 'assistant', content: '안녕하세요!' }]);
    expect(prompt.page).toEqual({ path: '/calendar' });
    // 일반 질문도 자유롭게 답하라고 안내한다
    expect(ai.complete.mock.calls[1][2].system).toContain('일반 질문은 가진 지식으로 자유롭게 답하세요');

    // 다른 사용자에게는 보이지 않는다
    expect((await api().get('/api/assistant/messages').set(auth(b)).expect(200)).body).toEqual([]);

    await api().delete('/api/assistant/messages').set(auth()).expect(200);
    expect((await api().get('/api/assistant/messages').set(auth()).expect(200)).body).toEqual([]);
  });

  it('AI 가 실패하면 질문도 저장하지 않는다', async () => {
    ai.complete.mockRejectedValueOnce(new Error('boom'));
    await api().post('/api/assistant/chat').set(auth()).send({ message: '실패할 질문' }).expect(500);
    expect((await api().get('/api/assistant/messages').set(auth()).expect(200)).body).toEqual([]);
  });

  it('할 일을 한 번에 5개보다 많이 제안할 수 있고, 적용 상태가 대화에 남는다', async () => {
    const tasks = Array.from({ length: 8 }, (_, i) => ({ kind: 'task_create', targetId: 'new', title: `할 일 ${i + 1}`, priority: 'HIGH', dueDate: '2030-01-0' + ((i % 9) + 1) + 'T18:00:00+09:00' }));
    reply('8개를 추가할게요. 확인하면 적용돼요.', tasks);
    const chat = (await api().post('/api/assistant/chat').set(auth()).send({ message: '할 일 8개 추가해줘' }).expect(201)).body;
    expect(chat.actions).toHaveLength(8);
    expect(JSON.parse(chat.actions[0].payload)).toEqual({ title: '할 일 1', priority: 'HIGH', dueDate: '2030-01-01T09:00:00.000Z' });
    // 확인 전에는 아무것도 생기지 않는다
    expect(await db.task.count({ where: { userId: a.user.id } })).toBe(0);

    for (const action of chat.actions.slice(0, 7)) await confirm(action.id).expect(201);
    await api().post(`/api/assistant/actions/${chat.actions[7].id}/cancel`).set(auth()).expect(201);
    expect(await db.task.count({ where: { userId: a.user.id } })).toBe(7);

    const saved = (await api().get('/api/assistant/messages').set(auth()).expect(200)).body.at(-1);
    expect(saved.actions.map((x: { state?: string }) => x.state)).toEqual([...Array(7).fill('적용 완료'), '취소됨']);

    // 새 채팅은 확인하지 않은 제안도 취소한다
    reply('하나 더요.', [{ kind: 'task_create', targetId: 'new', title: '남은 제안' }]);
    const left = (await api().post('/api/assistant/chat').set(auth()).send({ message: '하나 더' }).expect(201)).body.actions[0];
    await api().delete('/api/assistant/messages').set(auth()).expect(200);
    await confirm(left.id).expect(409);
  });

  it('할 일 수정: 제목·우선순위·마감 변경, 마감 지우기, 완료 되돌리기', async () => {
    const task = await db.task.create({ data: { userId: a.user.id, title: '보고서', dueDate: new Date('2030-02-01T00:00:00Z'), completed: true, completedAt: new Date() } });
    await propose({ kind: 'task_update', targetId: task.id }).expect(400);
    await propose({ kind: 'task_update', targetId: task.id, priority: 'NOPE' }).expect(400);
    await propose({ kind: 'task_update', targetId: task.id, dueDate: '2030-02-01' }).expect(400);
    const p = (await propose({ kind: 'task_update', targetId: task.id, title: '최종 보고서', priority: 'URGENT', dueDate: '', completed: false }).expect(201)).body;
    expect(JSON.parse(p.payload)).toEqual({ title: '최종 보고서', priority: 'URGENT', dueDate: '', completed: 'false' });
    await api().post(`/api/assistant/actions/${p.id}/confirm`).set(auth(b)).expect(404);
    await confirm(p.id).expect(201);
    expect(await db.task.findUnique({ where: { id: task.id } })).toMatchObject({ title: '최종 보고서', priority: 'URGENT', dueDate: null, completed: false, completedAt: null });
    // 남의 할 일은 제안할 수 없다
    await api().post('/api/assistant/actions').set(auth(b)).send({ kind: 'task_update', targetId: task.id, title: '침입' }).expect(404);
  });

  it('일정 수정: 바뀌는 칸만 보여 주고, 규칙을 다시 검사하며, Google 일정은 막는다', async () => {
    const e = await db.event.create({ data: { userId: a.user.id, title: '회의', startAt: new Date('2030-03-01T05:00:00Z'), endAt: new Date('2030-03-01T06:00:00Z') } });
    const p = (await propose({ kind: 'event_update', targetId: e.id, title: '팀 회의', startAt: '2030-03-01T15:00:00+09:00', endAt: '2030-03-01T16:30:00+09:00' }).expect(201)).body;
    expect(JSON.parse(p.payload)).toEqual({ title: '팀 회의', startAt: '2030-03-01T06:00:00.000Z', endAt: '2030-03-01T07:30:00.000Z' });
    // 종료가 시작보다 앞서면 안 된다
    await propose({ kind: 'event_update', targetId: e.id, endAt: '2030-03-01T13:00:00+09:00' }).expect(400);
    await propose({ kind: 'event_update', targetId: e.id, title: '회의' }).expect(400);
    await confirm(p.id).expect(201);
    expect(await db.event.findUnique({ where: { id: e.id } })).toMatchObject({ title: '팀 회의', endAt: new Date('2030-03-01T07:30:00Z') });

    const google = await db.event.create({ data: { userId: a.user.id, title: 'G', source: 'GOOGLE', startAt: new Date('2030-03-02T00:00:00Z'), endAt: new Date('2030-03-02T01:00:00Z') } });
    await propose({ kind: 'event_update', targetId: google.id, title: '바꾸기' }).expect(400);
  });

  it('학습 노트 추가·수정: 태그 정리, 본문 덧붙이기, 바뀐 뒤에는 적용 안 됨', async () => {
    const created = (await propose({ kind: 'note_create', targetId: 'new', title: 'TypeScript', content: '# 타입', tags: [' ts ', 'ts', '언어'] }).expect(201)).body;
    const note = (await confirm(created.id).expect(201)).body;
    expect(await db.studyNote.findUnique({ where: { id: note.targetId } })).toMatchObject({ title: 'TypeScript', content: '# 타입', tags: '["ts","언어"]' });

    const append = (await propose({ kind: 'note_update', targetId: note.targetId, appendContent: '## 제네릭' }).expect(201)).body;
    await confirm(append.id).expect(201);
    expect((await db.studyNote.findUnique({ where: { id: note.targetId } }))!.content).toBe('# 타입\n\n## 제네릭');

    const stale = (await propose({ kind: 'note_update', targetId: note.targetId, title: '새 제목' }).expect(201)).body;
    await db.studyNote.update({ where: { id: note.targetId }, data: { content: '사용자가 직접 고침' } });
    await confirm(stale.id).expect(409);
    await propose({ kind: 'note_update', targetId: note.targetId, appendContent: 'x'.repeat(20000), content: 'y'.repeat(40000) }).expect(400);
  });

  it('지금 보는 노트를 AI 에게 함께 보낸다 (내 노트만)', async () => {
    const mine = await db.studyNote.create({ data: { userId: a.user.id, title: '내 노트', content: '비밀 아님' } });
    const other = await db.studyNote.create({ data: { userId: b.user.id, title: '남의 노트', content: '남의 내용' } });
    reply('네.'); reply('네.');
    await api().post('/api/assistant/chat').set(auth()).send({ message: '이 노트 요약해줘', page: `/study?note=${mine.id}` }).expect(201);
    await api().post('/api/assistant/chat').set(auth()).send({ message: '이 노트 요약해줘', page: `/study?note=${other.id}` }).expect(201);
    expect(JSON.parse(ai.complete.mock.calls[0][2].prompt).page.currentNote).toMatchObject({ id: mine.id, content: '비밀 아님' });
    expect(JSON.parse(ai.complete.mock.calls[1][2].prompt).page.currentNote).toBeUndefined();
  });
});

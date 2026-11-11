import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { GeminiService } from '../src/ai/gemini.service';
import { ChatGptService } from '../src/ai/chatgpt.service';
import { ClaudeCodeService } from '../src/ai/claude-code.service';
describe('Gemini authenticated routing', () => {
  let app: INestApplication; let db: PrismaService; let articleId: string;
  let a: { user: { id: string }; accessToken: string }, b: typeof a;
  const connected = new Set<string>();
  const gemini = {
    status: jest.fn(async (userId: string) => ({ enabled: true, connected: connected.has(userId), model: 'account-gemini', pending: false, message: '' })),
    models: jest.fn().mockResolvedValue([{ id: 'account-gemini', name: 'Gemini account model' }]),
    start: jest.fn(async (userId: string) => { connected.add(userId); return { message: 'connected' }; }),
    disconnect: jest.fn(async (userId: string) => { connected.delete(userId); return { disconnected: true }; }),
    complete: jest.fn().mockResolvedValue({ text: JSON.stringify({ answer: 'Gemini 비서 응답', actions: [] }), provider: 'gemini', model: 'account-gemini', demo: false }),
  };
  const api = () => request(app.getHttpServer());
  const auth = (user = a) => ({ Authorization: `Bearer ${user.accessToken}` });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(GeminiService).useValue(gemini).overrideProvider(ChatGptService).useValue({ status: async () => ({ connected: false }) }).overrideProvider(ClaudeCodeService).useValue({ connection: async () => ({ connected: false }) }).compile();
    app = module.createNestApplication(); configureApp(app); await app.init(); db = app.get(PrismaService); await db.user.deleteMany();
    a = (await api().post('/api/auth/register').send({ email: 'gemini-a@test.com', name: 'A', password: 'password123' }).expect(201)).body;
    b = (await api().post('/api/auth/register').send({ email: 'gemini-b@test.com', name: 'B', password: 'password123' }).expect(201)).body;
    // News is shared across users; isolate this suite from articles left by other suites.
    await db.newsArticle.deleteMany();
    articleId = (await db.newsArticle.create({ data: { title: 'Gemini 뉴스 테스트', url: 'https://example.com/gemini-news', source: 'Test', category: 'TECH', excerpt: '확인된 RSS 근거', publishedAt: new Date() } })).id;
  });
  afterAll(async () => { await db.newsArticle.deleteMany({ where: { id: articleId } }); await db.user.deleteMany(); await app.close(); });
  it('protects all Gemini controls and connects only the authenticated app user', async () => {
    await api().get('/api/ai/gemini').expect(401); await api().post('/api/ai/gemini/connect').expect(401); await api().post('/api/ai/gemini/disconnect').expect(401);
    await api().post('/api/ai/gemini/connect').set(auth()).send({ userId: b.user.id }).expect(201);
    expect((await api().get('/api/ai/connections').set(auth()).expect(200)).body.providers).toEqual(['gemini']);
    expect((await api().get('/api/ai/connections').set(auth(b)).expect(200)).body.providers).toEqual([]);
    expect((await api().get('/api/ai/models').set(auth()).expect(200)).body.groups).toEqual([{ provider: 'gemini', label: 'Gemini', models: [{ id: 'account-gemini', name: 'Gemini account model' }] }]);
  });
  it('routes chat and news to Gemini and records the actual provider', async () => {
    await api().patch('/api/ai/selection').set(auth()).send({ provider: 'gemini' }).expect(200);
    const reply = await api().post('/api/assistant/chat').set(auth()).send({ message: '일정을 알려줘', provider: 'gemini', model: 'account-gemini' }).expect(201);
    expect(reply.body).toMatchObject({ provider: 'gemini', answer: 'Gemini 비서 응답', demo: false });
    expect(gemini.complete).toHaveBeenLastCalledWith(a.user.id, expect.objectContaining({ provider: 'gemini', model: 'account-gemini' }));
    gemini.complete.mockResolvedValueOnce({ text: JSON.stringify({ summary: ['하나', '둘', '셋'], articles: [{ id: articleId, summary: '요약', importance: '추정', impact: '추정' }] }), provider: 'gemini', model: 'account-gemini', demo: false });
    expect((await api().post('/api/news/briefing/analyze?category=TECH').set(auth()).expect(201)).body).toMatchObject({ available: true, provider: 'gemini' });
    expect(await db.aiUsageLog.count({ where: { userId: a.user.id, provider: 'gemini', success: true } })).toBe(2);
  });
  it('removes disconnected Gemini from models and blocks later inference', async () => {
    await api().post('/api/ai/gemini/disconnect').set(auth()).expect(201);
    expect((await api().get('/api/ai/models').set(auth()).expect(200)).body.groups).toEqual([]);
    const calls = gemini.complete.mock.calls.length;
    await api().post('/api/assistant/chat').set(auth()).send({ message: '안녕', provider: 'gemini', model: 'account-gemini' }).expect(400);
    expect(gemini.complete).toHaveBeenCalledTimes(calls);
  });
});

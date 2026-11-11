import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { ChatGptService } from '../src/ai/chatgpt.service';
import { AiError } from '../src/ai/ai.types';
import { ClaudeCliProvider } from '../src/ai/providers/claude-cli.provider';
import { readArticle } from '../src/news/news.reader';
import { ClaudeCodeService } from '../src/ai/claude-code.service';
jest.mock('../src/news/news.reader', () => ({ readArticle: jest.fn() }));

describe('per-user AI selection', () => {
  let app: INestApplication;
  let a: { user: { id: string }; accessToken: string }, b: typeof a;
  let articleId: string;
  let claudeConnected = true, gptConnected = true;
  const chatgpt = { status: jest.fn(async () => ({ enabled: true, connected: gptConnected, model: 'test-model', message: 'connected' })), complete: jest.fn().mockResolvedValue({ text: 'mock ChatGPT reply', provider: 'chatgpt', model: 'test-model', demo: false }) };
  const api = () => request(app.getHttpServer());
  const auth = (account = a) => ({ Authorization: `Bearer ${account.accessToken}` });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ChatGptService).useValue(chatgpt).overrideProvider(ClaudeCodeService).useValue({ connection: jest.fn(async () => ({ connected: claudeConnected, installed: true })) }).compile();
    app = module.createNestApplication(); configureApp(app); await app.init();
    const db = app.get(PrismaService); await db.user.deleteMany();
    a = (await api().post('/api/auth/register').send({ email: 'choice-a@test.com', name: 'A', password: 'password123' }).expect(201)).body;
    b = (await api().post('/api/auth/register').send({ email: 'choice-b@test.com', name: 'B', password: 'password123' }).expect(201)).body;
    const article = await db.newsArticle.create({ data: { url: 'https://example.com/ai-selection-news', title: '선택한 AI 뉴스', source: 'Test', category: 'TECH', excerpt: '', publishedAt: new Date() } });
    articleId = article.id;
    (readArticle as jest.Mock).mockResolvedValue({ available: true, text: '뉴스 원문 근거', url: article.url });
  });
  afterAll(async () => { await app.get(PrismaService).newsArticle.deleteMany({ where: { id: articleId } }); await app.get(PrismaService).user.deleteMany(); await app.close(); });
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => { claudeConnected = true; gptConnected = true; });
  it('requires login and stores selections for the authenticated user only', async () => {
    await api().get('/api/ai/selection').expect(401);
    await api().patch('/api/ai/selection').set(auth()).send({ provider: 'chatgpt' }).expect(200);
    expect((await api().get('/api/ai/selection').set(auth()).expect(200)).body.provider).toBe('chatgpt');
    expect((await api().get('/api/ai/selection').set(auth(b)).expect(200)).body.provider).toBe('demo');
    await api().patch('/api/ai/selection').set(auth()).send({ provider: 'other' }).expect(400);
    await api().patch('/api/ai/selection').set(auth()).send({ provider: 'claude-cli', userId: b.user.id }).expect(400);
  });
  it('routes completion to the selected ChatGPT account and logs the real provider', async () => {
    const reply = await api().post('/api/ai/test').set(auth()).expect(200);
    expect(reply.body).toMatchObject({ provider: 'chatgpt', demo: false });
    expect(chatgpt.complete).toHaveBeenCalledWith(a.user.id, expect.any(Object));
    expect((await app.get(PrismaService).aiUsageLog.findFirstOrThrow({ where: { userId: a.user.id }, orderBy: { createdAt: 'desc' } })).provider).toBe('chatgpt');
    expect((await api().get('/api/ai/status').set(auth()).expect(200)).body.provider).toBe('chatgpt');
  });
  it('does not silently fall back to Claude or sign out of the app when ChatGPT fails', async () => {
    const claude = jest.spyOn(ClaudeCliProvider.prototype, 'complete');
    chatgpt.complete.mockRejectedValueOnce(new AiError('ChatGPT 계정을 다시 연결해 주세요.', 400));
    await api().post('/api/ai/test').set(auth()).expect(400);
    expect(claude).not.toHaveBeenCalled();
    await api().get('/api/users/me').set(auth()).expect(200);
  });
  it('switches to Claude explicitly for subsequent requests', async () => {
    const claude = jest.spyOn(ClaudeCliProvider.prototype, 'complete').mockResolvedValue({ text: 'mock Claude reply', provider: 'claude-cli', demo: false });
    await api().patch('/api/ai/selection').set(auth()).send({ provider: 'claude-cli' }).expect(200);
    expect((await api().post('/api/ai/test').set(auth()).expect(200)).body.provider).toBe('claude-cli');
    expect(claude).toHaveBeenCalledTimes(1);
  });
  it('routes news analysis and individual original summaries to the selected account', async () => {
    await api().post(`/api/news/${articleId}/summary`).expect(401);
    await api().patch('/api/ai/selection').set(auth()).send({ provider: 'chatgpt' }).expect(200);
    chatgpt.complete.mockResolvedValueOnce({ text: JSON.stringify({ summary: ['하나', '둘', '셋'], articles: [{ id: articleId, summary: 'ChatGPT 원문 요약', importance: '추정', impact: '추정' }] }), provider: 'chatgpt', model: 'test-model', demo: false });
    const result = await api().post('/api/news/briefing/analyze?category=TECH').set(auth()).send({ userId: b.user.id }).expect(201);
    expect(result.body).toMatchObject({ available: true, provider: 'chatgpt' });
    expect(chatgpt.complete).toHaveBeenLastCalledWith(a.user.id, expect.objectContaining({ prompt: expect.stringContaining('뉴스 원문 근거') }));
    expect((await api().post(`/api/news/${articleId}/summary`).set(auth()).expect(201)).body).toMatchObject({ summary: 'ChatGPT 원문 요약', provider: 'chatgpt' });
    expect((await api().get('/api/news/briefing?category=TECH').set(auth(b)).expect(200)).body.analysis).toBeNull();
    expect((await api().get('/api/news').set(auth(b)).expect(200)).body.articles.find((item: { id: string }) => item.id === articleId).articleSummary).toBeNull();
    const claude = jest.spyOn(ClaudeCliProvider.prototype, 'complete').mockResolvedValue({ text: JSON.stringify({ summary: 'Claude 원문 요약' }), provider: 'claude-cli', demo: false });
    await api().patch('/api/ai/selection').set(auth()).send({ provider: 'claude-cli' }).expect(200);
    expect((await api().post(`/api/news/${articleId}/summary`).set(auth()).expect(201)).body).toMatchObject({ summary: 'Claude 원문 요약', provider: 'claude-cli' });
    expect(claude).toHaveBeenCalledTimes(1);
  });
  it('invalidates news caches on model changes and does not fall back after ChatGPT errors', async () => {
    await api().patch('/api/ai/selection').set(auth()).send({ provider: 'chatgpt' }).expect(200);
    await app.get(PrismaService).integration.upsert({ where: { userId_provider: { userId: a.user.id, provider: 'CHATGPT' } }, create: { userId: a.user.id, provider: 'CHATGPT', metadata: JSON.stringify({ model: 'new-model' }) }, update: { metadata: JSON.stringify({ model: 'new-model' }) } });
    expect((await api().get('/api/news/briefing?category=TECH').set(auth()).expect(200)).body.analysis).toBeNull();
    const claude = jest.spyOn(ClaudeCliProvider.prototype, 'complete');
    chatgpt.complete.mockRejectedValueOnce(new AiError('ChatGPT 사용 한도를 확인해 주세요.', 429));
    expect((await api().post(`/api/news/${articleId}/summary`).set(auth()).expect(201)).body).toEqual({ available: false, message: 'ChatGPT 사용 한도를 확인해 주세요.' });
    expect(claude).not.toHaveBeenCalled();
    await api().get('/api/users/me').set(auth()).expect(200);
  });
  it('shows only enabled model groups, including both services when both is selected', async () => {
    Object.assign(chatgpt, { models: jest.fn().mockResolvedValue([{ id: 'test-model', name: 'Test model' }]) });
    await api().get('/api/ai/models').expect(401);
    for (const [c, g, expected] of [[true, false, ['claude-cli']], [false, true, ['chatgpt']], [true, true, ['claude-cli', 'chatgpt']]] as const) {
      claudeConnected = c; gptConnected = g;
      const catalog = (await api().get('/api/ai/models').set(auth()).expect(200)).body;
      expect(catalog.groups.map((group: { provider: string }) => group.provider)).toEqual(expected);
    }
  });
  it('forwards the chat model to the chosen service and leaves the shared default untouched', async () => {
    const previous = (await app.get(PrismaService).integration.findUniqueOrThrow({ where: { userId_provider: { userId: a.user.id, provider: 'CHATGPT' } } })).metadata;
    chatgpt.complete.mockResolvedValueOnce({ text: JSON.stringify({ answer: 'ChatGPT 답변', actions: [] }), provider: 'chatgpt', model: 'test-model', demo: false });
    const reply = await api().post('/api/assistant/chat').set(auth()).send({ message: '할 일을 정리해줘', provider: 'chatgpt', model: 'test-model' }).expect(201);
    expect(reply.body).toMatchObject({ provider: 'chatgpt', model: 'test-model', answer: 'ChatGPT 답변' });
    expect(chatgpt.complete).toHaveBeenLastCalledWith(a.user.id, expect.objectContaining({ provider: 'chatgpt', model: 'test-model' }));
    const claude = jest.spyOn(ClaudeCliProvider.prototype, 'complete').mockResolvedValue({ text: JSON.stringify({ answer: 'Claude 답변', actions: [] }), provider: 'claude-cli', model: 'sonnet', demo: false });
    expect((await api().post('/api/assistant/chat').set(auth()).send({ message: '일정 알려줘', provider: 'claude-cli', model: 'sonnet' }).expect(201)).body.provider).toBe('claude-cli');
    expect(claude).toHaveBeenCalled();
    expect((await app.get(PrismaService).integration.findUniqueOrThrow({ where: { userId_provider: { userId: a.user.id, provider: 'CHATGPT' } } })).metadata).toBe(previous);
    expect((await api().get('/api/ai/selection').set(auth()).expect(200)).body.provider).toBe('chatgpt');
  });
  it('rejects chat overrides outside the chosen service and invalid model input', async () => {
    await api().patch('/api/ai/selection').set(auth()).send({ provider: 'claude-cli' }).expect(200);
    gptConnected = false;
    gptConnected = false;
    await api().post('/api/assistant/chat').set(auth()).send({ message: '안녕', provider: 'chatgpt', model: 'test-model' }).expect(400);
    await api().post('/api/assistant/chat').set(auth()).send({ message: '안녕', provider: 'claude-cli', model: 'unknown' }).expect(400);
    await api().post('/api/assistant/chat').set(auth()).send({ message: '안녕', model: 'sonnet' }).expect(400);
    await api().post('/api/assistant/chat').set(auth()).send({ message: '안녕', provider: 'other', model: 'sonnet' }).expect(400);
  });
  it('disconnects Claude only for this app user and restores it through explicit reconnect', async () => {
    await api().post('/api/ai/claude-code/disconnect').expect(401);
    await api().post('/api/ai/claude-code/disconnect').set(auth()).expect(201);
    expect((await api().get('/api/ai/connections').set(auth()).expect(200)).body.claude).toMatchObject({ connected: false, loginConnected: true });
    expect((await api().get('/api/ai/models').set(auth()).expect(200)).body.groups.map((group: { provider: string }) => group.provider)).toEqual(['chatgpt']);
    expect((await api().get('/api/ai/connections').set(auth(b)).expect(200)).body.claude.connected).toBe(true);
    await api().post('/api/assistant/chat').set(auth()).send({ message: '안녕', provider: 'claude-cli', model: 'sonnet' }).expect(400);
    claudeConnected = false;
    await api().post('/api/ai/claude-code/connect').set(auth()).expect(400);
    claudeConnected = true;
    await api().post('/api/ai/claude-code/connect').set(auth()).expect(201);
    expect((await api().get('/api/ai/connections').set(auth()).expect(200)).body.claude.connected).toBe(true);
  });
});

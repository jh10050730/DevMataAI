import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsService } from './news.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { readArticle } from './news.reader';
jest.mock('./news.reader', () => ({ readArticle: jest.fn() }));
describe('news through selected AI', () => {
  const article = { id: 'a', title: 'News', excerpt: 'RSS excerpt', source: 'Publisher', url: 'https://example.com/news' };
  let news: NewsService; let ai: any; let db: any;
  let choices: Record<string, { provider: string; model: string }>;
  const analysis = (id = 'a') => ({ summary: ['a', 'b', 'c'], articles: [{ id, summary: '원문 요약', importance: '추정', impact: '추정' }] });
  function output(value: unknown) { ai.complete.mockImplementation(async (user: string) => ({ text: JSON.stringify(value), provider: choices[user].provider, model: choices[user].model, demo: false })); }
  beforeEach(() => {
    jest.clearAllMocks();
    choices = { a: { provider: 'claude-cli', model: 'claude-model' }, b: { provider: 'chatgpt', model: 'gpt-model' } };
    ai = { cacheScope: jest.fn(async (user: string) => ({ provider: choices[user].provider, key: JSON.stringify([user, choices[user]]) })), complete: jest.fn() };
    db = { newsArticle: { findMany: jest.fn().mockResolvedValue([article]), findUnique: jest.fn().mockResolvedValue(article), count: jest.fn().mockResolvedValue(1) } };
    news = new NewsService(db as PrismaService, new ConfigService({ AI_PROVIDER: 'demo' }), ai as AiService);
    (readArticle as jest.Mock).mockResolvedValue({ available: true, text: '실제 원문 근거', url: article.url });
    output(analysis());
  });
  afterEach(() => jest.restoreAllMocks());
  it.each(['a', 'b'])('routes the authenticated user %s through AiService despite a demo app default', async user => {
    expect(await news.analyze(user)).toMatchObject({ available: true, provider: choices[user].provider });
    expect(ai.complete).toHaveBeenCalledWith(user, 'news-briefing', expect.objectContaining({ prompt: expect.stringContaining('RSS excerpt') }), expect.any(String));
  });
  it('deduplicates same-user concurrent requests and reuses validated cached analysis', async () => {
    const [a, b] = await Promise.all([news.analyze('a'), news.analyze('a')]);
    expect(a).toEqual(b); expect(ai.complete).toHaveBeenCalledTimes(1);
    expect((await news.briefing(undefined, 'a')).analysis).toEqual(a);
    await news.analyze('a'); expect(ai.complete).toHaveBeenCalledTimes(1);
  });
  it('isolates concurrent and cached results by user, provider and model', async () => {
    await Promise.all([news.analyze('a'), news.analyze('b')]); expect(ai.complete).toHaveBeenCalledTimes(2);
    choices.a = { provider: 'chatgpt', model: 'gpt-model' };
    expect((await news.briefing(undefined, 'a')).analysis).toBeNull(); await news.analyze('a');
    choices.a.model = 'another-model';
    expect((await news.briefing(undefined, 'a')).analysis).toBeNull(); await news.analyze('a');
    expect(ai.complete).toHaveBeenCalledTimes(4);
  });
  it('isolates category results even when categories have the same articles', async () => {
    const tech = await news.analyze('a', 'TECH'); await news.analyze('a', 'ECONOMY');
    expect(ai.complete).toHaveBeenCalledTimes(2);
    expect((await news.briefing('TECH', 'a')).analysis).toEqual(tech);
    db.newsArticle.findMany.mockResolvedValue([{ ...article, id: 'new' }]);
    expect((await news.briefing('TECH', 'a')).analysis).toBeNull();
  });
  it('expires cached analysis', async () => {
    const now = Date.now(); jest.spyOn(Date, 'now').mockReturnValue(now);
    await news.analyze('a'); jest.spyOn(Date, 'now').mockReturnValue(now + 3600001);
    expect((await news.briefing(undefined, 'a')).analysis).toBeNull();
    await news.analyze('a'); expect(ai.complete).toHaveBeenCalledTimes(2);
  });
  it('does not cache an in-flight response after the selection changes', async () => {
    ai.complete.mockImplementation(async () => { choices.a = { provider: 'chatgpt', model: 'new' }; return { text: JSON.stringify(analysis()), provider: 'claude-cli', demo: false }; });
    await news.analyze('a'); expect((await news.briefing(undefined, 'a')).analysis).toBeNull();
    choices.a = { provider: 'claude-cli', model: 'claude-model' };
    expect((await news.briefing(undefined, 'a')).analysis).toBeNull();
  });
  it('rejects invented articles and demo completions without caching them', async () => {
    output(analysis('invented')); expect(await news.analyze('a')).toMatchObject({ available: false });
    ai.complete.mockResolvedValue({ text: JSON.stringify(analysis()), provider: 'demo', demo: true });
    expect(await news.analyze('a')).toMatchObject({ available: false });
    expect((await news.briefing(undefined, 'a')).analysis).toBeNull();
  });
  it('does not invoke AI in a user-selected demo mode', async () => {
    choices.a.provider = 'demo'; expect(await news.analyze('a')).toMatchObject({ available: false });
    expect(await news.articleSummary('a', 'a')).toMatchObject({ available: false }); expect(ai.complete).not.toHaveBeenCalled();
  });
  it('reads missing excerpts and shares per-article summary only within the same scope', async () => {
    db.newsArticle.findMany.mockResolvedValue([{ ...article, excerpt: '' }]);
    expect(await news.analyze('b')).toMatchObject({ available: true, sourceArticles: [{ bodyStatus: 'read', summary: '원문 요약' }] });
    expect(ai.complete.mock.calls[0][2].prompt).toContain('실제 원문 근거');
    expect(await news.articleSummary('a', 'b')).toMatchObject({ available: true, summary: '원문 요약', provider: 'chatgpt' });
    expect((await news.list('', undefined, 'b')).articles[0].articleSummary).toMatchObject({ provider: 'chatgpt' });
    expect((await news.list('', undefined, 'a')).articles[0].articleSummary).toBeNull();
    expect((await news.list()).articles[0].articleSummary).toBeNull();
    expect(ai.complete).toHaveBeenCalledTimes(1);
  });
  it('deduplicates individual article requests and separates users/models', async () => {
    output({ summary: '한국어 원문 요약입니다.' });
    const [first, second] = await Promise.all([news.articleSummary('a', 'a'), news.articleSummary('a', 'a')]);
    expect(first).toEqual(second); expect(first).toMatchObject({ available: true, sourceUrl: article.url });
    expect(ai.complete).toHaveBeenCalledTimes(1);
    await news.articleSummary('a', 'b'); choices.b.model = 'new'; await news.articleSummary('a', 'b');
    expect(ai.complete).toHaveBeenCalledTimes(3);
  });
  it('does not send inaccessible originals to either provider', async () => {
    (readArticle as jest.Mock).mockResolvedValue({ available: false, message: '접근 제한' });
    expect(await news.articleSummary('a', 'b')).toEqual({ available: false, message: '접근 제한' }); expect(ai.complete).not.toHaveBeenCalled();
    db.newsArticle.findMany.mockResolvedValue([{ ...article, excerpt: '' }]);
    expect(await news.analyze('b')).toMatchObject({ sourceArticles: [{ bodyStatus: 'unavailable', bodyMessage: '접근 제한' }] });
    expect(ai.complete.mock.calls[0][2].prompt).toContain('제목 외 근거 없음');
  });
  it('does not cache invalid summaries and preserves selected-provider errors without fallback', async () => {
    output({ summary: null }); expect(await news.articleSummary('a', 'b')).toMatchObject({ available: false });
    ai.complete.mockRejectedValue(new HttpException('ChatGPT 계정을 다시 연결해 주세요.', 400));
    expect(await news.articleSummary('a', 'b')).toEqual({ available: false, message: 'ChatGPT 계정을 다시 연결해 주세요.' });
    expect(await news.analyze('b')).toMatchObject({ available: false, message: 'ChatGPT 계정을 다시 연결해 주세요.' });
    output({ summary: '다시 생성' }); expect(await news.articleSummary('a', 'b')).toMatchObject({ available: true });
    expect(ai.complete.mock.calls.every(([user]: [string]) => user === 'b')).toBe(true);
  });
});

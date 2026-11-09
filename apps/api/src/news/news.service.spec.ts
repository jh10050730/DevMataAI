import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { NewsService } from './news.service';
import { PrismaService } from '../prisma/prisma.service';
import { readArticle } from './news.reader';
jest.mock('node:child_process', () => ({ ...jest.requireActual('node:child_process'), execFile: jest.fn() }));
jest.mock('./news.reader', () => ({ readArticle: jest.fn() }));
describe('news AI briefing', () => {
  const article = { id: 'a', title: 'News', excerpt: 'RSS excerpt', source: 'Publisher', url: 'https://example.com/news' };
  function service(provider = 'claude-cli') {
    const db = { newsArticle: { findMany: jest.fn().mockResolvedValue([article]) } };
    return new NewsService(db as unknown as PrismaService, new ConfigService({ AI_PROVIDER: provider }));
  }
  function output(value: unknown) {
    (execFile as unknown as jest.Mock).mockImplementation((_path, _args, _options, callback) => {
      callback(null, JSON.stringify(value));
      return { stdin: { on: jest.fn(), end: jest.fn() } };
    });
  }
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());
  it('검증된 응답만 반환하고 동일 기사의 중복 AI 호출을 방지', async () => {
    output({ summary: ['a', 'b', 'c'], articles: [{ id: 'a', importance: '추정', impact: '추정' }] });
    const news = service();
    expect(await news.analyze()).toMatchObject({ available: true });
    await news.analyze();
    expect(execFile).toHaveBeenCalledTimes(1);
  });
  it('브리핑 조회에서 기존 AI 요약과 정확한 원문 출처를 재사용', async () => {
    output({ summary: ['a', 'b', 'c'], articles: [{ id: 'a', importance: '추정', impact: '추정' }] });
    const news = service();
    expect((await news.briefing()).analysis).toBeNull();
    const analysis = await news.analyze();
    expect((await news.briefing()).analysis).toEqual(analysis);
    expect(analysis).toMatchObject({ sourceArticles: [article], generatedAt: expect.any(String) });
    expect(execFile).toHaveBeenCalledTimes(1);
  });
  it('분야별 요약을 유지하고 기사 목록이 바뀌면 이전 요약을 제외', async () => {
    const economy = { ...article, id: 'economy' };
    const findMany = jest.fn().mockImplementation(({ where }) => Promise.resolve(where.category === 'ECONOMY' ? [economy] : [article]));
    const news = new NewsService({ newsArticle: { findMany } } as unknown as PrismaService, new ConfigService({ AI_PROVIDER: 'claude-cli' }));
    output({ summary: ['a', 'b', 'c'], articles: [{ id: 'a', importance: '추정', impact: '추정' }] });
    const techAnalysis = await news.analyze('TECH');
    output({ summary: ['경제 a', '경제 b', '경제 c'], articles: [{ id: 'economy', importance: '추정', impact: '추정' }] });
    const economyAnalysis = await news.analyze('ECONOMY');
    expect((await news.briefing('TECH')).analysis).toEqual(techAnalysis);
    expect((await news.briefing('ECONOMY')).analysis).toEqual(economyAnalysis);
    await news.analyze('TECH');
    expect(execFile).toHaveBeenCalledTimes(2);
    findMany.mockResolvedValue([{ ...article, id: 'new' }]);
    expect((await news.briefing('TECH')).analysis).toBeNull();
  });
  it('유효기간이 지난 요약은 표시하지 않고 다시 생성', async () => {
    output({ summary: ['a', 'b', 'c'], articles: [{ id: 'a', importance: '추정', impact: '추정' }] });
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const news = service();
    await news.analyze();
    jest.spyOn(Date, 'now').mockReturnValue(now + 3600001);
    expect((await news.briefing()).analysis).toBeNull();
    await news.analyze();
    expect(execFile).toHaveBeenCalledTimes(2);
  });
  it('입력에 없는 기사 분석은 거부', async () => {
    output({ summary: ['a', 'b', 'c'], articles: [{ id: 'invented', importance: 'x', impact: 'y' }] });
    expect(await service().analyze()).toMatchObject({ available: false });
  });
  it('데모 모드에서는 AI 결과를 만들어 내지 않음', async () => {
    expect(await service('demo').analyze()).toMatchObject({ available: false });
    expect(execFile).not.toHaveBeenCalled();
  });
  it('발췌가 없으면 원문을 가져와 Claude 입력에 포함하고 기사별 요약을 재사용', async () => {
    const missing = { ...article, excerpt: '' };
    const db = { newsArticle: { findMany: jest.fn().mockResolvedValue([missing]), findUnique: jest.fn().mockResolvedValue(missing) } };
    const news = new NewsService(db as unknown as PrismaService, new ConfigService({ AI_PROVIDER: 'claude-cli' }));
    (readArticle as jest.Mock).mockResolvedValue({ available: true, text: '실제 원문 근거', url: article.url });
    output({ summary: ['a', 'b', 'c'], articles: [{ id: 'a', summary: '원문에서 확인한 내용입니다.', importance: '추정', impact: '추정' }] });
    const result = await news.analyze();
    expect(readArticle).toHaveBeenCalledWith(article.url);
    const stdin = (execFile as unknown as jest.Mock).mock.results[0].value.stdin;
    expect(stdin.end.mock.calls[0][0]).toContain('실제 원문 근거');
    expect(result).toMatchObject({ available: true, sourceArticles: [{ id: 'a', bodyStatus: 'read', summary: '원문에서 확인한 내용입니다.' }] });
    expect(await news.articleSummary('a')).toMatchObject({ available: true, summary: '원문에서 확인한 내용입니다.' });
    expect(execFile).toHaveBeenCalledTimes(1);
  });
  it('원문 접근 실패를 표시하고 읽은 기사처럼 요약을 저장하지 않음', async () => {
    const db = { newsArticle: { findMany: jest.fn().mockResolvedValue([{ ...article, excerpt: '' }]) } };
    const news = new NewsService(db as unknown as PrismaService, new ConfigService({ AI_PROVIDER: 'claude-cli' }));
    (readArticle as jest.Mock).mockResolvedValue({ available: false, message: '접근 제한' });
    output({ summary: ['확인 불가', '제목만 제공됨', '원문 접근 실패'], articles: [{ id: 'a', summary: '확인 불가', importance: '확인 불가', impact: '확인 불가' }] });
    expect(await news.analyze()).toMatchObject({ sourceArticles: [{ bodyStatus: 'unavailable', bodyMessage: '접근 제한' }] });
    const stdin = (execFile as unknown as jest.Mock).mock.results[0].value.stdin;
    expect(stdin.end.mock.calls[0][0]).toContain('제목 외 근거 없음');
  });
  it('개별 기사 요약 동시 요청을 합치고 원문 요약만 반환', async () => {
    const db = { newsArticle: { findUnique: jest.fn().mockResolvedValue(article) } };
    const news = new NewsService(db as unknown as PrismaService, new ConfigService({ AI_PROVIDER: 'claude-cli' }));
    (readArticle as jest.Mock).mockResolvedValue({ available: true, text: '본문 근거', url: article.url });
    output({ summary: '한국어 원문 요약입니다.' });
    const [first, second] = await Promise.all([news.articleSummary('a'), news.articleSummary('a')]);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ available: true, summary: '한국어 원문 요약입니다.', sourceUrl: article.url });
    expect(readArticle).toHaveBeenCalledTimes(1);
    expect(execFile).toHaveBeenCalledTimes(1);
  });
  it('읽지 못한 원문은 Claude에 보내지 않음', async () => {
    const db = { newsArticle: { findUnique: jest.fn().mockResolvedValue(article) } };
    const news = new NewsService(db as unknown as PrismaService, new ConfigService({ AI_PROVIDER: 'claude-cli' }));
    (readArticle as jest.Mock).mockResolvedValue({ available: false, message: '접근 제한' });
    expect(await news.articleSummary('a')).toEqual({ available: false, message: '접근 제한' });
    expect(execFile).not.toHaveBeenCalled();
  });
  it('유효하지 않은 AI 원문 요약은 저장하지 않고 재시도를 허용', async () => {
    const db = { newsArticle: { findUnique: jest.fn().mockResolvedValue(article) } };
    const news = new NewsService(db as unknown as PrismaService, new ConfigService({ AI_PROVIDER: 'claude-cli' }));
    (readArticle as jest.Mock).mockResolvedValue({ available: true, text: '본문 근거', url: article.url });
    output({ summary: null });
    expect(await news.articleSummary('a')).toMatchObject({ available: false });
    output({ summary: '다시 생성한 요약' });
    expect(await news.articleSummary('a')).toMatchObject({ available: true });
  });
});

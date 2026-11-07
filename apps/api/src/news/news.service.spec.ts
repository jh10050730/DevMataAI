import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { NewsService } from './news.service';
import { PrismaService } from '../prisma/prisma.service';
jest.mock('node:child_process', () => ({ ...jest.requireActual('node:child_process'), execFile: jest.fn() }));
describe('news AI briefing', () => {
  const article = { id: 'a', title: 'News', excerpt: 'RSS excerpt', source: 'Publisher' };
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
  it('검증된 응답만 반환하고 동일 기사의 중복 AI 호출을 방지', async () => {
    output({ summary: ['a', 'b', 'c'], articles: [{ id: 'a', importance: '추정', impact: '추정' }] });
    const news = service();
    expect(await news.analyze()).toMatchObject({ available: true });
    await news.analyze();
    expect(execFile).toHaveBeenCalledTimes(1);
  });
  it('입력에 없는 기사 분석은 거부', async () => {
    output({ summary: ['a', 'b', 'c'], articles: [{ id: 'invented', importance: 'x', impact: 'y' }] });
    expect(await service().analyze()).toMatchObject({ available: false });
  });
  it('데모 모드에서는 AI 결과를 만들어 내지 않음', async () => {
    expect(await service('demo').analyze()).toMatchObject({ available: false });
    expect(execFile).not.toHaveBeenCalled();
  });
});

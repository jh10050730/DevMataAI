import { ConfigService } from '@nestjs/config';
import { NewsService } from './news.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

const parseURL = jest.fn();
jest.mock('rss-parser', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({ parseURL })) }));

describe('뉴스 마지막 수집 시각', () => {
  let db: any; let news: NewsService;
  beforeEach(() => {
    parseURL.mockReset();
    db = {
      newsArticle: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) },
      newsCollectionState: { upsert: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue(null) },
    };
    news = new NewsService(db as PrismaService, new ConfigService({ NEWS_AUTO_COLLECT: 'false' }), {} as AiService);
  });

  it('한 곳이라도 받아 오면 자동·수동 상관없이 마지막 수집 시각을 남긴다', async () => {
    parseURL.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ items: [] });
    await news.refresh();
    expect(db.newsCollectionState.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'daily' }, update: { lastCollectedAt: expect.any(Date) } }));
  });

  it('모두 실패하면 마지막 수집 시각을 바꾸지 않는다', async () => {
    parseURL.mockRejectedValue(new Error('offline'));
    await news.refresh();
    expect(db.newsCollectionState.upsert).not.toHaveBeenCalled();
  });

  it('화면에는 저장된 시각을, 없으면 가장 최근 기사가 들어온 시각을 보여 준다', async () => {
    const saved = new Date('2026-11-12T01:00:00Z'), article = new Date('2026-11-11T22:00:00Z');
    db.newsCollectionState.findUnique.mockResolvedValue({ id: 'daily', lastCollectedAt: saved, lastAttemptAt: null, completedDay: null, lastResult: '{}' });
    expect((await news.schedule()).lastCollectedAt).toEqual(saved);
    db.newsCollectionState.findUnique.mockResolvedValue({ id: 'daily', lastCollectedAt: null, lastAttemptAt: null, completedDay: null, lastResult: '{}' });
    db.newsArticle.findFirst.mockResolvedValue({ collectedAt: article });
    expect((await news.schedule()).lastCollectedAt).toEqual(article);
    db.newsArticle.findFirst.mockResolvedValue(null);
    expect((await news.schedule()).lastCollectedAt).toBeNull();
  });
});

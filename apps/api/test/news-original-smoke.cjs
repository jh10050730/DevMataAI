// Uses existing news rows. Calls the explicit app user's selected AI and records AI usage.
process.env.NEWS_AUTO_COLLECT = 'false';
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { NewsService } = require('../dist/news/news.service');
const { PrismaService } = require('../dist/prisma/prisma.service');
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const userId = process.env.NEWS_SMOKE_USER_ID;
    if (!userId || !await app.get(PrismaService).user.findUnique({ where: { id: userId } })) throw new Error('NEWS_SMOKE_USER_ID must identify an existing app user');
    const news = app.get(NewsService);
    const articles = await app.get(PrismaService).newsArticle.findMany({ where: { excerpt: '' }, orderBy: { collectedAt: 'desc' }, take: 3 });
    for (const article of articles) {
      const result = await news.articleSummary(article.id, userId);
      console.log(JSON.stringify({ title: article.title, url: article.url, ...result }));
      if (result.available && result.summary && result.sourceUrl) return;
    }
    console.error('No readable original article was summarized. Check source availability and the selected AI connection.');
    process.exitCode = 1;
  } finally { await app.close(); }
})().catch(() => { console.error('Original article smoke test failed'); process.exitCode = 1; });

// Uses existing news rows without changing the database. Calls configured Claude once a readable article is found.
process.env.NEWS_AUTO_COLLECT = 'false';
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { NewsService } = require('../dist/news/news.service');
const { PrismaService } = require('../dist/prisma/prisma.service');
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const news = app.get(NewsService);
    const articles = await app.get(PrismaService).newsArticle.findMany({ where: { excerpt: '' }, orderBy: { collectedAt: 'desc' }, take: 3 });
    for (const article of articles) {
      const result = await news.articleSummary(article.id);
      console.log(JSON.stringify({ title: article.title, url: article.url, ...result }));
      if (result.available && result.summary && result.sourceUrl) return;
    }
    console.error('No readable original article was summarized. Check source availability and Claude configuration.');
    process.exitCode = 1;
  } finally { await app.close(); }
})().catch(() => { console.error('Original article smoke test failed'); process.exitCode = 1; });

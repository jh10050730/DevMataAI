// Run from apps/api after building: node test/news-smoke.cjs
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { NewsService } = require('../dist/news/news.service');
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const news = app.get(NewsService);
    console.log(JSON.stringify(await news.refresh()));
    const list = await news.list();
    const briefing = await news.briefing();
    console.log(JSON.stringify({ total: list.total, briefingArticles: briefing.articles.length, articles: list.articles.slice(0, 2).map(a => ({ title: a.title, source: a.source, url: a.url })) }));
    if (!list.total) process.exitCode = 1;
  } finally { await app.close(); }
})().catch(() => { console.error('News smoke test failed'); process.exitCode = 1; });

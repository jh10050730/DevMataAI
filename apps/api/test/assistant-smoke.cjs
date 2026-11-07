require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { AssistantService } = require('../dist/assistant/assistant.service');
const { PrismaService } = require('../dist/prisma/prisma.service');
process.env.NEWS_AUTO_COLLECT = 'false';
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const db = app.get(PrismaService);
  let user;
  try {
    user = await db.user.create({ data: { email: `assistant-smoke-${Date.now()}@example.invalid`, name: '비서 연결 검사', passwordHash: 'no-login' } });
    const result = await app.get(AssistantService).chat(user.id, { message: '내 일정이나 할 일을 모르면 지어내지 말고 저장된 항목이 있는지만 짧게 알려줘.' });
    console.log(JSON.stringify({ provider: result.provider, demo: result.demo, answer: result.answer.slice(0, 1000), proposedActions: result.actions.length }));
    if (result.demo || !result.answer.trim()) process.exitCode = 1;
  } finally {
    if (user) await db.user.delete({ where: { id: user.id } });
    await app.close();
  }
})().catch(() => { console.error('Assistant live AI check failed. Check AI configuration or login.'); process.exitCode = 1; });

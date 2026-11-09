// 실제 AI 연결 검사: 프로젝트 폴더를 읽어 AI 진행률을 추정하고, 비서가 프로젝트 추가를 "제안"만 하는지 확인한다.
// 사용: npm run build && npm run progress:smoke -w apps/api [-- <프로젝트 폴더>]  (기본값: 이 저장소)
// 임시 검사 계정을 만들고 끝나면 삭제한다. 설정된 AI 제공자의 사용량이 발생한다.
require('reflect-metadata');
const { resolve } = require('node:path');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { ProjectsService } = require('../dist/projects/projects.service');
const { AssistantService } = require('../dist/assistant/assistant.service');
const { PrismaService } = require('../dist/prisma/prisma.service');
process.env.NEWS_AUTO_COLLECT = 'false';
(async () => {
  const folder = resolve(process.argv[2] ?? `${__dirname}/../../..`);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const db = app.get(PrismaService);
  let user;
  try {
    user = await db.user.create({ data: { email: `progress-smoke-${Date.now()}@example.invalid`, name: '진행률 검사', passwordHash: 'no-login' } });
    const projects = app.get(ProjectsService);
    const project = await projects.save(user.id, { name: 'DevMate AI', goal: '일정·할 일·학습·뉴스·프로젝트를 한곳에서 관리하고 AI 비서가 돕는 개인 워크스페이스 완성', localPath: folder });
    const started = Date.now();
    const analysis = await projects.analyze(user.id, project.id);
    console.log(JSON.stringify({ step: 'analyze', seconds: Math.round((Date.now() - started) / 1000), demo: analysis.demo, aiProgress: analysis.aiProgress, confidence: analysis.detail?.confidence, summary: analysis.detail?.summary, done: analysis.detail?.done, remaining: analysis.detail?.remaining, read: (analysis.detail ?? analysis).sources?.map(s => s.read) }, null, 2));
    const chat = await app.get(AssistantService).chat(user.id, { message: '"블로그 리뉴얼"이라는 프로젝트를 추가해줘. 목표는 디자인 개편이야.' });
    const created = await db.project.count({ where: { userId: user.id, name: { contains: '블로그' } } });
    console.log(JSON.stringify({ step: 'chat', demo: chat.demo, actions: chat.actions.map(a => ({ kind: a.kind, targetTitle: a.targetTitle, payload: a.payload })), createdBeforeConfirm: created }, null, 2));
    if (analysis.demo || typeof analysis.aiProgress !== 'number' || created !== 0) process.exitCode = 1;
  } finally {
    if (user) await db.user.delete({ where: { id: user.id } });
    await app.close();
  }
})().catch(e => { console.error('Progress live AI check failed:', e?.message ?? e); process.exitCode = 1; });

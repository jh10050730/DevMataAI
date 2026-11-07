import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/** AI(데모 프로바이더) · Notion(미설정) · 연동 상태 */
describe('Study tools / AI / Integrations (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let other: string;
  let noteId: string;
  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const stamp = Date.now();
    token = (await api().post('/api/auth/register').send({ email: `tools-${stamp}@test.com`, name: 'T', password: 'password123' })).body.accessToken;
    other = (await api().post('/api/auth/register').send({ email: `tools-o-${stamp}@test.com`, name: 'O', password: 'password123' })).body.accessToken;
    noteId = (await api().post('/api/study/notes').set(auth(token)).send({ title: 'TCP', content: '# TCP\n3-way handshake' })).body.id;
  });

  afterAll(() => app.close());

  it('연동 상태: 데모 AI, Notion 미설정, 토큰 값 비노출', async () => {
    const res = await api().get('/api/integrations/status').set(auth(token)).expect(200);
    expect(res.body.ai).toMatchObject({ provider: 'demo', demo: true, ok: true });
    expect(res.body.notion).toMatchObject({ configured: false });
    expect(JSON.stringify(res.body)).not.toMatch(/secret|token=/i);
  });

  it('노트 AI 요약 → 데모 응답임을 표시하고 사용량을 기록', async () => {
    const res = await api().post(`/api/study/notes/${noteId}/ai`).set(auth(token)).send({ action: 'summary' }).expect(200);
    expect(res.body).toMatchObject({ action: 'summary', provider: 'demo', demo: true });
    expect(res.body.text).toContain('데모 응답');

    const status = await api().get('/api/ai/status').set(auth(token)).expect(200);
    expect(status.body.last24h.calls).toBeGreaterThanOrEqual(1);
  });

  it('질문하기는 질문이 필수, 알 수 없는 기능은 400', async () => {
    await api().post(`/api/study/notes/${noteId}/ai`).set(auth(token)).send({ action: 'ask' }).expect(400);
    await api().post(`/api/study/notes/${noteId}/ai`).set(auth(token)).send({ action: 'ask', question: '3-way handshake 가 뭐야?' }).expect(200);
    await api().post(`/api/study/notes/${noteId}/ai`).set(auth(token)).send({ action: 'hack' }).expect(400);
  });

  it('다른 사용자의 노트로는 AI / Notion 저장 불가 (404)', async () => {
    await api().post(`/api/study/notes/${noteId}/ai`).set(auth(other)).send({ action: 'summary' }).expect(404);
    await api().post(`/api/study/notes/${noteId}/notion`).set(auth(other)).send({}).expect(404);
  });

  it('Notion 미설정 시 가져오기/저장은 안내와 함께 400', async () => {
    const imp = await api()
      .post('/api/study/notion/import')
      .set(auth(token))
      .send({ page: 'https://www.notion.so/Test-0123456789abcdef0123456789abcdef' })
      .expect(400);
    expect(imp.body.message).toContain('NOTION_TOKEN');
    await api().post('/api/study/notion/import').set(auth(token)).send({ page: 'x'.repeat(40) }).expect(400);
    const exp = await api().post(`/api/study/notes/${noteId}/notion`).set(auth(token)).send({}).expect(400);
    expect(exp.body.message).toContain('NOTION_TOKEN');
  });
});

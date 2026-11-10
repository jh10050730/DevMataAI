import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('처음 해 볼 일 (GET /api/dashboard/getting-started)', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  const email = 'getting-started@gmail.com';

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApp(app); await app.init();
  });
  afterAll(async () => { await app.get(PrismaService).user.deleteMany({ where: { email } }); await app.close(); });

  it('로그인이 필요하고, 새 계정은 해 본 것이 없으며, 할 일·일정을 만들면 완료로 바뀜', async () => {
    await api().get('/api/dashboard/getting-started').expect(401);
    const { body } = await api().post('/api/auth/register').send({ email, name: '처음', password: 'getting-started-1' }).expect(201);
    const auth = { Authorization: `Bearer ${body.accessToken}` };

    const before = await api().get('/api/dashboard/getting-started').set(auth).expect(200);
    expect(before.body).toMatchObject({ task: false, event: false, note: false, project: false, google: false });
    expect(typeof before.body.ai).toBe('boolean');

    await api().post('/api/tasks').set(auth).send({ title: '첫 할 일', category: 'PERSONAL' }).expect(201);
    const start = new Date(); const end = new Date(start.getTime() + 3_600_000);
    await api().post('/api/events').set(auth).send({ title: '첫 일정', startAt: start.toISOString(), endAt: end.toISOString() }).expect(201);

    const after = await api().get('/api/dashboard/getting-started').set(auth).expect(200);
    expect(after.body).toMatchObject({ task: true, event: true, note: false, project: false });
  });
});

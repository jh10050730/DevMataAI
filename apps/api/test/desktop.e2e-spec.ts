import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('앱 정보 (GET /api/desktop/info, POST /api/desktop/open)', () => {
  let app: INestApplication;
  let auth: { Authorization: string };
  const api = () => request(app.getHttpServer());
  const email = 'desktop-info@gmail.com';
  const keys = ['DEVMATA_DESKTOP', 'DEVMATA_VERSION', 'DEVMATA_DATA_DIR', 'DEVMATA_LOG_DIR'] as const;
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApp(app); await app.init();
    const { body } = await api().post('/api/auth/register').send({ email, name: '앱정보', password: 'desktop-info-1' }).expect(201);
    auth = { Authorization: `Bearer ${body.accessToken}` };
  });
  afterEach(() => { for (const k of keys) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
  afterAll(async () => { await app.get(PrismaService).user.deleteMany({ where: { email } }); await app.close(); });

  it('로그인이 필요하고, 웹 실행에서는 버전만 알려 준다', async () => {
    await api().get('/api/desktop/info').expect(401);
    delete process.env.DEVMATA_DESKTOP;
    process.env.DEVMATA_DATA_DIR = 'C:\\secret';
    const { body } = await api().get('/api/desktop/info').set(auth).expect(200);
    expect(body).toEqual({ desktop: false, version: expect.stringMatching(/^\d+\.\d+\.\d+/) });
  });

  it('데스크톱 앱에서는 앱 버전과 데이터·로그 폴더를 알려 준다', async () => {
    Object.assign(process.env, { DEVMATA_DESKTOP: '1', DEVMATA_VERSION: '1.2.3', DEVMATA_DATA_DIR: 'C:\\Users\\me\\AppData\\Roaming\\DevMata AI', DEVMATA_LOG_DIR: 'C:\\Users\\me\\AppData\\Roaming\\DevMata AI\\logs' });
    const { body } = await api().get('/api/desktop/info').set(auth).expect(200);
    expect(body).toEqual({ desktop: true, version: '1.2.3', dataDir: 'C:\\Users\\me\\AppData\\Roaming\\DevMata AI', logDir: 'C:\\Users\\me\\AppData\\Roaming\\DevMata AI\\logs' });
  });

  it('폴더 열기: 정해진 대상만, 웹 실행에서는 404, 관리자가 아니면 403', async () => {
    await api().post('/api/desktop/open').send({ target: 'data' }).expect(401);
    process.env.DEVMATA_DESKTOP = '1';
    await api().post('/api/desktop/open').set(auth).send({ target: 'C:\\Windows' }).expect(400);
    await api().post('/api/desktop/open').set(auth).send({}).expect(400);
    delete process.env.DEVMATA_DESKTOP;
    await api().post('/api/desktop/open').set(auth).send({ target: 'logs' }).expect(404);

    // 테스트 DB 에는 이 계정보다 먼저 만든 계정이 있을 수 있다 → 그럴 때는 관리자가 아니어서 403
    process.env.DEVMATA_DESKTOP = '1';
    const first = await app.get(PrismaService).user.findFirst({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { email: true } });
    if (first?.email !== email) await api().post('/api/desktop/open').set(auth).send({ target: 'data' }).expect(403);
  });
});

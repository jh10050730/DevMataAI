import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('DevMate API (e2e)', () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const prisma = app.get(PrismaService);
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth', () => {
    it('회원가입 → 토큰과 공개 사용자 정보 반환 (비밀번호 해시 미노출)', async () => {
      const res = await api()
        .post('/api/auth/register')
        .send({ email: ' A@Test.com ', name: '사용자A', password: 'password123' })
        .expect(201);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user.email).toBe('a@test.com');
      expect(res.body.user.passwordHash).toBeUndefined();
      tokenA = res.body.accessToken;

      const resB = await api()
        .post('/api/auth/register')
        .send({ email: 'b@test.com', name: '사용자B', password: 'password123' })
        .expect(201);
      tokenB = resB.body.accessToken;
    });

    it('중복 이메일은 409', () =>
      api().post('/api/auth/register').send({ email: 'a@test.com', name: 'x', password: 'password123' }).expect(409));

    it('잘못된 입력은 400 (짧은 비밀번호, 알 수 없는 필드)', async () => {
      await api().post('/api/auth/register').send({ email: 'c@test.com', name: 'c', password: '123' }).expect(400);
      await api()
        .post('/api/auth/register')
        .send({ email: 'c@test.com', name: 'c', password: 'password123', isAdmin: true })
        .expect(400);
    });

    it('로그인 성공 / 비밀번호 오류 401', async () => {
      await api().post('/api/auth/login').send({ email: 'a@test.com', password: 'password123' }).expect(200);
      await api().post('/api/auth/login').send({ email: 'a@test.com', password: 'wrong-pass' }).expect(401);
    });

    it('토큰 없이 보호된 API 접근 시 401, 공개 API는 200', async () => {
      await api().get('/api/tasks').expect(401);
      await api().get('/api/tasks').set(auth('invalid.token.value')).expect(401);
      await api().get('/api/health').expect(200);
    });

    it('내 정보 조회', async () => {
      const res = await api().get('/api/users/me').set(auth(tokenA)).expect(200);
      expect(res.body.name).toBe('사용자A');
    });
  });

  describe('Tasks', () => {
    let taskId: string;

    it('생성 → 목록 → 완료 → 진행률', async () => {
      const created = await api()
        .post('/api/tasks')
        .set(auth(tokenA))
        .send({ title: '  알고리즘 과제  ', priority: 'HIGH', category: 'STUDY', dueDate: '2026-11-10T09:00:00.000Z' })
        .expect(201);
      expect(created.body.title).toBe('알고리즘 과제');
      taskId = created.body.id;

      await api().post('/api/tasks').set(auth(tokenA)).send({ title: '운동', category: 'PERSONAL' }).expect(201);

      const list = await api().get('/api/tasks').set(auth(tokenA)).expect(200);
      expect(list.body).toHaveLength(2);
      expect(list.body[0].id).toBe(taskId); // 마감일 있는 항목이 먼저

      const done = await api().patch(`/api/tasks/${taskId}`).set(auth(tokenA)).send({ completed: true }).expect(200);
      expect(done.body.completedAt).not.toBeNull();

      const stats = await api().get('/api/tasks/stats').set(auth(tokenA)).expect(200);
      expect(stats.body).toMatchObject({ total: 2, done: 1, rate: 50 });
      expect(stats.body.byCategory.find((c: { category: string }) => c.category === 'STUDY').rate).toBe(100);

      const active = await api().get('/api/tasks?status=active').set(auth(tokenA)).expect(200);
      expect(active.body).toHaveLength(1);
    });

    it('잘못된 중요도는 400', () =>
      api().post('/api/tasks').set(auth(tokenA)).send({ title: 'x', priority: 'SUPER' }).expect(400));

    it('다른 사용자의 할 일은 조회/수정/삭제 불가 (404)', async () => {
      const listB = await api().get('/api/tasks').set(auth(tokenB)).expect(200);
      expect(listB.body).toHaveLength(0);
      await api().patch(`/api/tasks/${taskId}`).set(auth(tokenB)).send({ title: 'hack' }).expect(404);
      await api().delete(`/api/tasks/${taskId}`).set(auth(tokenB)).expect(404);
    });

    it('삭제', async () => {
      await api().delete(`/api/tasks/${taskId}`).set(auth(tokenA)).expect(200);
      await api().delete(`/api/tasks/${taskId}`).set(auth(tokenA)).expect(404);
    });
  });

  describe('Events', () => {
    let eventId: string;
    const range = 'from=2026-11-01T00:00:00.000Z&to=2026-12-01T00:00:00.000Z';

    it('생성 → 기간 조회 → 수정', async () => {
      const created = await api()
        .post('/api/events')
        .set(auth(tokenA))
        .send({ title: '팀 회의', startAt: '2026-11-07T05:00:00.000Z', endAt: '2026-11-07T06:00:00.000Z' })
        .expect(201);
      eventId = created.body.id;

      const list = await api().get(`/api/events?${range}`).set(auth(tokenA)).expect(200);
      expect(list.body).toHaveLength(1);

      const outside = await api()
        .get('/api/events?from=2026-12-01T00:00:00.000Z&to=2026-12-31T00:00:00.000Z')
        .set(auth(tokenA))
        .expect(200);
      expect(outside.body).toHaveLength(0);

      const updated = await api().patch(`/api/events/${eventId}`).set(auth(tokenA)).send({ location: '301호' }).expect(200);
      expect(updated.body.location).toBe('301호');
    });

    it('종료가 시작보다 빠르면 400', async () => {
      await api()
        .post('/api/events')
        .set(auth(tokenA))
        .send({ title: 'x', startAt: '2026-11-07T06:00:00.000Z', endAt: '2026-11-07T05:00:00.000Z' })
        .expect(400);
      await api()
        .patch(`/api/events/${eventId}`)
        .set(auth(tokenA))
        .send({ endAt: '2026-11-01T00:00:00.000Z' })
        .expect(400);
    });

    it('기간 파라미터 누락 시 400', () => api().get('/api/events').set(auth(tokenA)).expect(400));

    it('다른 사용자의 일정은 접근 불가', async () => {
      const list = await api().get(`/api/events?${range}`).set(auth(tokenB)).expect(200);
      expect(list.body).toHaveLength(0);
      await api().delete(`/api/events/${eventId}`).set(auth(tokenB)).expect(404);
    });
  });

  describe('Study', () => {
    let subjectId: string;
    let noteId: string;

    it('과목과 노트 생성, 태그 정리, 검색', async () => {
      const subject = await api().post('/api/study/subjects').set(auth(tokenA)).send({ name: '자료구조' }).expect(201);
      subjectId = subject.body.id;
      const note = await api().post('/api/study/notes').set(auth(tokenA))
        .send({ title: ' 트리 ', content: '# 이진 트리', subjectId, tags: [' tree ', 'tree', ''], progress: 20 }).expect(201);
      noteId = note.body.id;
      expect(note.body).toMatchObject({ title: '트리', tags: ['tree'], reviewDue: true, progress: 20 });
      const found = await api().get('/api/study/notes?q=트리&tag=tree&due=true').set(auth(tokenA)).expect(200);
      expect(found.body.map((n: { id: string }) => n.id)).toEqual([noteId]);
    });

    it('다른 사용자의 노트와 과목은 접근하거나 연결할 수 없음', async () => {
      const list = await api().get('/api/study/notes').set(auth(tokenB)).expect(200);
      expect(list.body).toEqual([]);
      await api().get(`/api/study/notes/${noteId}`).set(auth(tokenB)).expect(404);
      await api().patch(`/api/study/notes/${noteId}`).set(auth(tokenB)).send({ title: '변조' }).expect(404);
      await api().delete(`/api/study/notes/${noteId}`).set(auth(tokenB)).expect(404);
      await api().post(`/api/study/notes/${noteId}/studied`).set(auth(tokenB)).send({ rating: 'good' }).expect(404);
      await api().post('/api/study/notes').set(auth(tokenB)).send({ title: 'x', subjectId }).expect(404);
      await api().delete(`/api/study/subjects/${subjectId}`).set(auth(tokenB)).expect(404);
    });

    it('학습 기록과 진행률 집계, 잘못된 입력 차단', async () => {
      const studied = await api().post(`/api/study/notes/${noteId}/studied`).set(auth(tokenA))
        .send({ rating: 'good', progress: 100 }).expect(201);
      expect(studied.body).toMatchObject({ reviewCount: 1, progress: 100, reviewDue: false });
      expect(new Date(studied.body.nextReviewAt).getTime() - new Date(studied.body.lastStudiedAt).getTime()).toBe(86400000);
      const overview = await api().get('/api/study/overview').set(auth(tokenA)).expect(200);
      expect(overview.body).toMatchObject({ total: 1, due: 0 });
      expect(overview.body.subjects.find((s: { id: string }) => s.id === subjectId)).toMatchObject({ completed: 1, progress: 100 });
      await api().patch(`/api/study/notes/${noteId}`).set(auth(tokenA)).send({ progress: 101 }).expect(400);
      await api().get('/api/study/notes?due=invalid').set(auth(tokenA)).expect(400);
    });

    it('과목 삭제 시 노트를 유지하고 미분류로 변경, 노트 삭제', async () => {
      await api().delete(`/api/study/subjects/${subjectId}`).set(auth(tokenA)).expect(200);
      const note = await api().get(`/api/study/notes/${noteId}`).set(auth(tokenA)).expect(200);
      expect(note.body.subjectId).toBeNull();
      await api().delete(`/api/study/notes/${noteId}`).set(auth(tokenA)).expect(200);
      await api().get(`/api/study/notes/${noteId}`).set(auth(tokenA)).expect(404);
    });
  });

  describe('News', () => {
    it('인증 보호, 검색·분류 필터, 오늘의 출처 포함 브리핑', async () => {
      await api().get('/api/news').expect(401);
      await api().post('/api/news/refresh').expect(401);
      await api().post('/api/news/briefing/analyze').expect(401);
      const db = app.get(PrismaService);
      await db.newsArticle.deleteMany();
      await db.newsArticle.create({ data: { title: 'AI 테스트 기사', url: 'https://example.com/ai', source: '테스트 출처', category: 'AI', excerpt: '확인된 발췌', publishedAt: new Date() } });
      await db.newsArticle.create({ data: { title: '오래된 기사', url: 'https://example.com/old', source: '테스트 출처', category: 'DEV', excerpt: '', publishedAt: new Date('2020-01-01') } });
      const list = await api().get('/api/news?q=테스트&category=AI').set(auth(tokenA)).expect(200);
      expect(list.body.total).toBe(1);
      expect(list.body.articles[0].url).toBe('https://example.com/ai');
      const brief = await api().get('/api/news/briefing').set(auth(tokenB)).expect(200);
      expect(brief.body.articles).toHaveLength(1);
      expect(brief.body.articles[0].source).toBe('테스트 출처');
      await api().get('/api/news?category=INVALID').set(auth(tokenA)).expect(400);
    });
  });

  describe('Dashboard', () => {
    it('오늘 요약: 지난 마감 / 오늘 마감 / 오늘 일정', async () => {
      await api().post('/api/tasks').set(auth(tokenA)).send({ title: '지난 과제', dueDate: '2026-11-05T09:00:00.000Z' });
      await api().post('/api/tasks').set(auth(tokenA)).send({ title: '오늘 과제', dueDate: '2026-11-07T09:00:00.000Z' });

      const res = await api()
        .get('/api/dashboard/today?from=2026-11-07T00:00:00.000Z&to=2026-11-08T00:00:00.000Z')
        .set(auth(tokenA))
        .expect(200);
      expect(res.body.tasks.overdue.map((t: { title: string }) => t.title)).toContain('지난 과제');
      expect(res.body.tasks.dueToday.map((t: { title: string }) => t.title)).toEqual(['오늘 과제']);
      expect(res.body.todayEvents).toHaveLength(1);
    });
  });
});

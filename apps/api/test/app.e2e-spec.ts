import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('DevMata AI API (e2e)', () => {
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
      const short = await api().post('/api/auth/register').send({ email: 'c@test.com', name: 'c', password: '12345' }).expect(400);
      expect(JSON.stringify(short.body)).toContain('6자 이상');
      await api().post('/api/auth/register').send({ email: 'six@test.com', name: 'six', password: '123456' }).expect(201);
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

  describe('Projects', () => {
    let projectId: string;
    let itemId: string;
    let otherId: string;
    it('프로젝트·기능·작업 생성과 완료 비율', async () => {
      await api().get('/api/projects').expect(401);
      const created = await api().post('/api/projects').set(auth(tokenA)).send({ name: ' 개인 앱 ', goal: '첫 배포' }).expect(201);
      projectId = created.body.id;
      expect(created.body.name).toBe('개인 앱');
      const item = await api().post(`/api/projects/${projectId}/items`).set(auth(tokenA)).send({ title: '인증', kind: 'FEATURE' }).expect(201);
      itemId = item.body.id;
      await api().post(`/api/projects/${projectId}/items`).set(auth(tokenA)).send({ title: '테스트' }).expect(201);
      const done = await api().patch(`/api/projects/${projectId}/items/${itemId}`).set(auth(tokenA)).send({ status: 'DONE' }).expect(200);
      expect(done.body.completedAt).not.toBeNull();
      const project = await api().get(`/api/projects/${projectId}`).set(auth(tokenA)).expect(200);
      expect(project.body.progress).toEqual({ total: 2, done: 1, rate: 50 });
      const other = await api().post('/api/projects').set(auth(tokenA)).send({ name: '다른 프로젝트' }).expect(201);
      otherId = other.body.id;
    });
    it('다른 사용자 및 다른 프로젝트의 작업 접근 차단', async () => {
      const list = await api().get('/api/projects').set(auth(tokenB)).expect(200);
      expect(list.body).toEqual([]);
      for (const path of ['', '/github', '/reports']) await api().get(`/api/projects/${projectId}${path}`).set(auth(tokenB)).expect(404);
      await api().patch(`/api/projects/${projectId}`).set(auth(tokenB)).send({ name: '변조' }).expect(404);
      await api().delete(`/api/projects/${projectId}`).set(auth(tokenB)).expect(404);
      await api().post(`/api/projects/${projectId}/reports`).set(auth(tokenB)).expect(404);
      await api().patch(`/api/projects/${otherId}/items/${itemId}`).set(auth(tokenA)).send({ status: 'DONE' }).expect(404);
      await api().delete(`/api/projects/${projectId}/items/${itemId}`).set(auth(tokenB)).expect(404);
    });
    it('빈 이름·잘못된 저장소·상태·null 차단', async () => {
      await api().post('/api/projects').set(auth(tokenA)).send({ name: '   ' }).expect(400);
      await api().post('/api/projects').set(auth(tokenA)).send({ name: 'x', repository: 'https://example.com' }).expect(400);
      await api().patch(`/api/projects/${projectId}`).set(auth(tokenA)).send({ name: null }).expect(400);
      await api().patch(`/api/projects/${projectId}/items/${itemId}`).set(auth(tokenA)).send({ status: 'SUPER' }).expect(400);
    });
    it('완료를 되돌리면 완료일 초기화, 미설정 GitHub와 데모 보고서', async () => {
      const undone = await api().patch(`/api/projects/${projectId}/items/${itemId}`).set(auth(tokenA)).send({ status: 'BLOCKED', notes: '배포 인증 문제' }).expect(200);
      expect(undone.body.completedAt).toBeNull();
      const github = await api().get(`/api/projects/${projectId}/github`).set(auth(tokenA)).expect(200);
      expect(github.body.connected).toBe(false);
      const report = await api().post(`/api/projects/${projectId}/reports`).set(auth(tokenA)).expect(201);
      expect(report.body.demo).toBe(true);
      const evidence = JSON.parse(report.body.evidence);
      expect(evidence.project.progress.rate).toBe(0);
      expect(evidence.completedThisWeek).toEqual([]);
      const history = await api().get(`/api/projects/${projectId}/reports`).set(auth(tokenA)).expect(200);
      expect(history.body[0].id).toBe(report.body.id);
    });
    it('프로젝트 삭제 시 작업과 보고서도 삭제', async () => {
      await api().delete(`/api/projects/${projectId}`).set(auth(tokenA)).expect(200);
      const db = app.get(PrismaService);
      expect(await db.projectItem.count({ where: { projectId } })).toBe(0);
      expect(await db.projectReport.count({ where: { projectId } })).toBe(0);
      await api().get(`/api/projects/${projectId}`).set(auth(tokenA)).expect(404);
    });
  });

  describe('Assistant', () => {
    let taskId: string;
    let foreignTaskId: string;
    let projectId: string;
    it('통합 검색과 브리핑은 다른 사용자 정보를 노출하지 않음', async () => {
      await api().get('/api/assistant/briefing').expect(401);
      const mine = await api().post('/api/tasks').set(auth(tokenA)).send({ title: '통합검증 내 작업', priority: 'HIGH' }).expect(201);
      taskId = mine.body.id;
      const foreign = await api().post('/api/tasks').set(auth(tokenB)).send({ title: '통합검증 비밀' }).expect(201);
      foreignTaskId = foreign.body.id;
      const project = await api().post('/api/projects').set(auth(tokenA)).send({ name: '통합검증 프로젝트', goal: '통합검증' }).expect(201);
      projectId = project.body.id;
      await api().post('/api/study/notes').set(auth(tokenA)).send({ title: '통합검증 학습', content: '통합검증 자료' }).expect(201);
      const search = await api().get('/api/assistant/search?q=통합검증').set(auth(tokenA)).expect(200);
      expect(search.body.results.some((r: { id: string }) => r.id === taskId)).toBe(true);
      expect(search.body.results.some((r: { id: string }) => r.id === foreignTaskId)).toBe(false);
      const brief = await api().get('/api/assistant/briefing').set(auth(tokenA)).expect(200);
      expect(brief.body.timezone).toBe('Asia/Seoul');
      expect(JSON.stringify(brief.body)).not.toContain('통합검증 비밀');
      await api().get('/api/assistant/search?q=%20').set(auth(tokenA)).expect(400);
    });
    it('관련 추천은 소유 프로젝트와 노트만 연결', async () => {
      const result = await api().get(`/api/assistant/recommendations/${projectId}`).set(auth(tokenA)).expect(200);
      expect(result.body.notes.map((n: { title: string }) => n.title)).toContain('통합검증 학습');
      await api().get(`/api/assistant/recommendations/${projectId}`).set(auth(tokenB)).expect(404);
    });
    it('제안만으로 변경하지 않으며 소유자 확인으로만 적용, 재실행 차단', async () => {
      const proposal = await api().post('/api/assistant/actions').set(auth(tokenA)).send({ kind: 'task_complete', targetId: taskId }).expect(201);
      expect((await app.get(PrismaService).task.findUniqueOrThrow({ where: { id: taskId } })).completed).toBe(false);
      await api().post(`/api/assistant/actions/${proposal.body.id}/confirm`).set(auth(tokenB)).expect(404);
      await api().post(`/api/assistant/actions/${proposal.body.id}/confirm`).set(auth(tokenA)).expect(201);
      expect((await app.get(PrismaService).task.findUniqueOrThrow({ where: { id: taskId } })).completed).toBe(true);
      await api().post(`/api/assistant/actions/${proposal.body.id}/confirm`).set(auth(tokenA)).expect(409);
      await api().post('/api/assistant/actions').set(auth(tokenA)).send({ kind: 'task_delete', targetId: foreignTaskId }).expect(404);
    });
    it('취소·만료·변경된 대상은 실행하지 않음', async () => {
      const propose = () => api().post('/api/assistant/actions').set(auth(tokenA)).send({ kind: 'task_rename', targetId: taskId, title: '새 제목' }).expect(201);
      const cancelled = await propose();
      await api().post(`/api/assistant/actions/${cancelled.body.id}/cancel`).set(auth(tokenA)).expect(201);
      await api().post(`/api/assistant/actions/${cancelled.body.id}/confirm`).set(auth(tokenA)).expect(409);
      const expired = await propose();
      const db = app.get(PrismaService);
      await db.assistantAction.update({ where: { id: expired.body.id }, data: { expiresAt: new Date(0) } });
      await api().post(`/api/assistant/actions/${expired.body.id}/confirm`).set(auth(tokenA)).expect(409);
      const stale = await propose();
      await db.task.update({ where: { id: taskId }, data: { updatedAt: new Date(Date.now() + 10000) } });
      await api().post(`/api/assistant/actions/${stale.body.id}/confirm`).set(auth(tokenA)).expect(409);
      expect((await db.task.findUniqueOrThrow({ where: { id: taskId } })).title).toBe('통합검증 내 작업');
    });
    it('Google 사본 일정은 비서에서도 읽기 전용이며 제목 변경은 저장된 제안만 적용', async () => {
      const me = await api().get('/api/users/me').set(auth(tokenA)).expect(200);
      const db = app.get(PrismaService);
      const event = await db.event.create({ data: { userId: me.body.id, title: '가져온 일정', source: 'GOOGLE', startAt: new Date(), endAt: new Date(Date.now() + 3600000) } });
      await api().post('/api/assistant/actions').set(auth(tokenA)).send({ kind: 'event_delete', targetId: event.id }).expect(400);
      expect(await db.event.findUnique({ where: { id: event.id } })).not.toBeNull();
      await db.event.delete({ where: { id: event.id } });
      const proposal = await api().post('/api/assistant/actions').set(auth(tokenA)).send({ kind: 'task_rename', targetId: taskId, title: '확인한 제목' }).expect(201);
      await api().post(`/api/assistant/actions/${proposal.body.id}/confirm`).set(auth(tokenA)).send({ title: '위조한 제목' }).expect(201);
      expect((await db.task.findUniqueOrThrow({ where: { id: taskId } })).title).toBe('확인한 제목');
    });
    it('확인한 삭제만 적용하며 잘못된 요청 차단', async () => {
      const proposal = await api().post('/api/assistant/actions').set(auth(tokenA)).send({ kind: 'task_delete', targetId: taskId }).expect(201);
      await api().post(`/api/assistant/actions/${proposal.body.id}/confirm`).set(auth(tokenA)).expect(201);
      expect(await app.get(PrismaService).task.findUnique({ where: { id: taskId } })).toBeNull();
      await api().post('/api/assistant/actions').set(auth(tokenA)).send({ kind: 'arbitrary', targetId: taskId }).expect(400);
      await api().post('/api/assistant/chat').set(auth(tokenA)).send({ message: ' ' }).expect(400);
      const chat = await api().post('/api/assistant/chat').set(auth(tokenA)).send({ message: '오늘 할 일을 알려줘' }).expect(201);
      expect(chat.body.demo).toBe(true);
      expect(chat.body.actions).toEqual([]);
    });
  });

  describe('Project files & AI project actions', () => {
    let root: string;
    let projectId: string;
    beforeAll(() => {
      root = mkdtempSync(join(tmpdir(), 'devmate-proj-'));
      mkdirSync(join(root, 'src'));
      mkdirSync(join(root, 'node_modules', 'x'), { recursive: true });
      writeFileSync(join(root, 'README.md'), '# 샘플 앱\n로그인 완료, 차트 미구현');
      writeFileSync(join(root, 'package.json'), '{"name":"sample"}');
      writeFileSync(join(root, 'src', 'main.ts'), 'console.log(1);');
      writeFileSync(join(root, '.env'), 'SECRET=1');
      writeFileSync(join(root, 'node_modules', 'x', 'index.js'), '');
      writeFileSync(join(root, 'image.bin'), Buffer.from([1, 0, 2]));
    });
    afterAll(() => rmSync(root, { recursive: true, force: true }));

    it('PC 폴더 등록 검증: 상대 경로·없는 폴더·드라이브 루트 거부', async () => {
      await api().post('/api/projects').set(auth(tokenA)).send({ name: 'x', localPath: 'relative/dir' }).expect(400);
      await api().post('/api/projects').set(auth(tokenA)).send({ name: 'x', localPath: join(root, 'missing') }).expect(400);
      await api().post('/api/projects').set(auth(tokenA)).send({ name: 'x', localPath: process.platform === 'win32' ? 'C:\\' : '/' }).expect(400);
      const created = await api().post('/api/projects').set(auth(tokenA)).send({ name: '파일 프로젝트', goal: '로그인과 차트', localPath: root }).expect(201);
      projectId = created.body.id;
      expect(created.body.localPath).toBeTruthy();
    });

    it('파일 목록은 비밀·의존성 폴더를 숨기고 내용 읽기는 폴더 안 텍스트만 허용', async () => {
      const list = await api().get(`/api/projects/${projectId}/files?source=local`).set(auth(tokenA)).expect(200);
      const paths = list.body.files.map((f: { path: string }) => f.path);
      expect(paths).toEqual(expect.arrayContaining(['README.md', 'package.json', 'src/main.ts']));
      expect(paths).not.toContain('.env');
      expect(paths.some((p: string) => p.startsWith('node_modules'))).toBe(false);
      const file = await api().get(`/api/projects/${projectId}/files/content?source=local&path=src/main.ts`).set(auth(tokenA)).expect(200);
      expect(file.body.content).toBe('console.log(1);');
      for (const bad of ['.env', '../outside.txt', 'node_modules/x/index.js', 'image.bin', 'missing.txt'])
        await api().get(`/api/projects/${projectId}/files/content?source=local&path=${encodeURIComponent(bad)}`).set(auth(tokenA)).expect(400);
      await api().get(`/api/projects/${projectId}/files?source=github`).set(auth(tokenA)).expect(400);
      await api().get(`/api/projects/${projectId}/files?source=local`).set(auth(tokenB)).expect(404);
    });

    it('AI 진행률 분석: 데모 모드는 값을 저장하지 않고 읽은 파일만 알려줌', async () => {
      const res = await api().post(`/api/projects/${projectId}/analyze`).set(auth(tokenA)).expect(201);
      expect(res.body.demo).toBe(true);
      expect(res.body.sources[0].read).toEqual(expect.arrayContaining(['README.md', 'package.json']));
      const project = await api().get(`/api/projects/${projectId}`).set(auth(tokenA)).expect(200);
      expect(project.body.aiProgress).toBeNull();
      const bare = await api().post('/api/projects').set(auth(tokenA)).send({ name: '폴더 없음' }).expect(201);
      await api().post(`/api/projects/${bare.body.id}/analyze`).set(auth(tokenA)).expect(400);
      await api().post(`/api/projects/${projectId}/analyze`).set(auth(tokenB)).expect(404);
    });

    it('비서 제안으로 프로젝트 추가·수정, 작업 추가·상태 변경·삭제 (확인 후에만 적용)', async () => {
      const db = app.get(PrismaService);
      const confirm = async (body: object) => {
        const p = await api().post('/api/assistant/actions').set(auth(tokenA)).send(body).expect(201);
        return (await api().post(`/api/assistant/actions/${p.body.id}/confirm`).set(auth(tokenA)).expect(201)).body;
      };
      const created = await confirm({ kind: 'project_create', targetId: 'new', name: '비서가 만든 프로젝트', goal: '목표' });
      expect((await db.project.findUniqueOrThrow({ where: { id: created.targetId } })).name).toBe('비서가 만든 프로젝트');
      await confirm({ kind: 'project_update', targetId: created.targetId, status: 'PAUSED', goal: '바뀐 목표' });
      expect(await db.project.findUniqueOrThrow({ where: { id: created.targetId } })).toMatchObject({ status: 'PAUSED', goal: '바뀐 목표' });
      const item = await confirm({ kind: 'item_create', targetId: created.targetId, title: '차트', itemKind: 'FEATURE' });
      await confirm({ kind: 'item_update', targetId: item.targetId, status: 'DONE' });
      expect((await db.projectItem.findUniqueOrThrow({ where: { id: item.targetId } })).completedAt).not.toBeNull();
      await confirm({ kind: 'item_delete', targetId: item.targetId });
      expect(await db.projectItem.findUnique({ where: { id: item.targetId } })).toBeNull();
      // 잘못된 값·다른 사용자 대상·바꿀 내용 없음은 제안 단계에서 거부
      await api().post('/api/assistant/actions').set(auth(tokenA)).send({ kind: 'project_create', targetId: 'new' }).expect(400);
      await api().post('/api/assistant/actions').set(auth(tokenA)).send({ kind: 'project_update', targetId: created.targetId }).expect(400);
      await api().post('/api/assistant/actions').set(auth(tokenA)).send({ kind: 'project_update', targetId: created.targetId, status: 'DONE' }).expect(400);
      await api().post('/api/assistant/actions').set(auth(tokenB)).send({ kind: 'item_create', targetId: created.targetId, title: '침입' }).expect(404);
      // 제안만으로는 만들어지지 않는다
      await api().post('/api/assistant/actions').set(auth(tokenA)).send({ kind: 'project_create', targetId: 'new', name: '확인 안 함' }).expect(201);
      expect(await db.project.count({ where: { name: '확인 안 함' } })).toBe(0);
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

  describe('Demo', () => {
    it('데모 데이터 추가 → isDemo 표시 → 중복 추가 409 → 삭제 시 실제 데이터는 유지', async () => {
      const before = await api().get('/api/tasks').set(auth(tokenA)).expect(200);
      const realTasks = before.body.length;
      expect((await api().get('/api/demo').set(auth(tokenA)).expect(200)).body.total).toBe(0);

      const created = await api().post('/api/demo').set(auth(tokenA)).expect(201);
      expect(created.body).toMatchObject({ tasks: 5, events: 4, notes: 3, total: 12 });
      const tasks = await api().get('/api/tasks').set(auth(tokenA)).expect(200);
      expect(tasks.body.filter((t: { isDemo: boolean }) => t.isDemo)).toHaveLength(5);
      await api().post('/api/demo').set(auth(tokenA)).expect(409);

      // 다른 사용자에게는 보이지 않고, 그 사용자의 삭제가 A의 데모를 지우지 않는다
      expect((await api().get('/api/demo').set(auth(tokenB)).expect(200)).body.total).toBe(0);
      expect((await api().delete('/api/demo').set(auth(tokenB)).expect(200)).body.total).toBe(0);

      expect((await api().delete('/api/demo').set(auth(tokenA)).expect(200)).body).toMatchObject({ tasks: 5, events: 4, notes: 3, total: 12 });
      expect((await api().get('/api/tasks').set(auth(tokenA)).expect(200)).body).toHaveLength(realTasks);
    });
  });
});

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiService } from '../src/ai/ai.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { BriefingService } from '../src/briefing/briefing.service';
import { DevLogService } from '../src/projects/devlog.service';

/** 반복 할 일·일정, 빠른 입력, 아침 브리핑, 개발일지 */
describe('daily features', () => {
  let app: INestApplication; let db: PrismaService;
  let a: { user: { id: string }; accessToken: string }, b: typeof a;
  const ai = { complete: jest.fn() };
  const api = () => request(app.getHttpServer());
  const auth = (user = a) => ({ Authorization: `Bearer ${user.accessToken}` });
  const stamp = Date.now();
  const kst = (s: string) => new Date(`${s}+09:00`);
  const DAY = 86_400_000;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(AiService).useValue(ai).compile();
    app = module.createNestApplication(); configureApp(app); await app.init(); db = app.get(PrismaService);
    a = (await api().post('/api/auth/register').send({ email: `daily-a-${stamp}@test.com`, name: 'A', password: 'password123' }).expect(201)).body;
    b = (await api().post('/api/auth/register').send({ email: `daily-b-${stamp}@test.com`, name: 'B', password: 'password123' }).expect(201)).body;
  });
  afterAll(async () => { await db.user.deleteMany({ where: { id: { in: [a.user.id, b.user.id] } } }); await app.close(); });
  beforeEach(() => ai.complete.mockReset());

  describe('반복', () => {
    it('반복 할 일은 마감일이 필요하고, 끝내면 다음 마감일로 하나만 새로 생긴다', async () => {
      await api().post('/api/tasks').set(auth()).send({ title: '마감 없는 반복', repeat: 'DAILY' }).expect(400);
      const due = new Date(Date.now() + 2 * DAY);
      const task = (await api().post('/api/tasks').set(auth()).send({ title: '주간 회고', dueDate: due.toISOString(), repeat: 'WEEKLY' }).expect(201)).body;
      expect(task.repeat).toBe('WEEKLY');
      const done = (await api().patch(`/api/tasks/${task.id}`).set(auth()).send({ completed: true }).expect(200)).body;
      expect(new Date(done.next.dueDate).getTime()).toBe(due.getTime() + 7 * DAY);
      expect(done.next.repeat).toBe('WEEKLY');
      // 완료를 취소했다가 다시 끝내도 두 번 만들지 않는다
      await api().patch(`/api/tasks/${task.id}`).set(auth()).send({ completed: false }).expect(200);
      await api().patch(`/api/tasks/${task.id}`).set(auth()).send({ completed: true }).expect(200);
      expect(await db.task.count({ where: { userId: a.user.id, title: '주간 회고' } })).toBe(2);
      // 반복을 끄려면 null
      expect((await api().patch(`/api/tasks/${done.next.id}`).set(auth()).send({ repeat: null }).expect(200)).body.repeat).toBeNull();
    });

    it('반복 일정은 조회 범위 안의 회차로 펼치고, 마감 알림에서는 빠진다', async () => {
      const start = kst('2026-11-02T10:00');
      const event = (await api().post('/api/events').set(auth()).send({ title: '주간 회의', startAt: start, endAt: new Date(+start + 3600000), repeat: 'WEEKLY', repeatUntil: kst('2026-11-20T23:59') }).expect(201)).body;
      const rows = (await api().get(`/api/events?from=${kst('2026-11-01T00:00').toISOString()}&to=${kst('2026-12-01T00:00').toISOString()}`).set(auth()).expect(200)).body as { id: string; startAt: string; series?: { startAt: string } }[];
      const mine = rows.filter(r => r.id === event.id);
      expect(mine.map(r => r.startAt)).toEqual(['2026-11-02T01:00:00.000Z', '2026-11-09T01:00:00.000Z', '2026-11-16T01:00:00.000Z']);
      expect(mine[1].series?.startAt).toBe(start.toISOString());
      await api().post('/api/events').set(auth()).send({ title: '잘못된 끝', startAt: start, endAt: new Date(+start + 3600000), repeat: 'DAILY', repeatUntil: kst('2026-11-01T00:00') }).expect(400);
      await app.get(NotificationsService).sync(new Date(+start - 2 * DAY));
      expect(await db.notification.count({ where: { targetId: event.id } })).toBe(0);
    });
  });

  describe('빠른 입력', () => {
    it('AI가 만든 일정·할 일 제안을 돌려주고, 확인하면 반복까지 그대로 들어간다', async () => {
      ai.complete.mockResolvedValueOnce({ provider: 'claude-cli', demo: false, text: JSON.stringify({ answer: '일정과 할 일을 만들었어요.', actions: [
        { kind: 'event_create', targetId: 'new', title: '팀 회의', startAt: '2026-11-16T10:00:00+09:00', endAt: '2026-11-16T11:00:00+09:00', allDay: false, repeat: 'WEEKLY' },
        { kind: 'task_create', targetId: 'new', title: '보고서 제출', dueDate: '2026-11-20T18:00:00+09:00' },
        { kind: 'task_delete', targetId: 'whatever' },
      ] }) });
      const res = (await api().post('/api/assistant/quick').set(auth()).send({ text: '매주 월요일 10시 팀 회의, 금요일까지 보고서' }).expect(201)).body;
      expect(res.ai).toBe(true);
      expect(res.actions.map((x: { kind: string }) => x.kind)).toEqual(['event_create', 'task_create']); // 빠른 입력은 추가만
      for (const action of res.actions) await api().post(`/api/assistant/actions/${action.id}/confirm`).set(auth()).expect(201);
      expect((await db.event.findFirstOrThrow({ where: { userId: a.user.id, title: '팀 회의' } })).repeat).toBe('WEEKLY');
      // 빠른 입력은 대화 기록에 남지 않는다
      expect(await db.assistantMessage.count({ where: { userId: a.user.id } })).toBe(0);
    });

    it('AI가 없으면 적은 그대로 할 일 제안을 만든다', async () => {
      ai.complete.mockRejectedValueOnce(new Error('AI 계정을 연결해 주세요.'));
      const res = (await api().post('/api/assistant/quick').set(auth()).send({ text: '우유 사기' }).expect(201)).body;
      expect(res).toMatchObject({ ai: false, actions: [{ kind: 'task_create', targetTitle: '우유 사기' }] });
      await api().post('/api/assistant/quick').set(auth()).send({ text: '   ' }).expect(400);
    });

    it('AI 비서로 반복 할 일을 끝내도 다음 할 일이 생긴다', async () => {
      const task = await db.task.create({ data: { userId: a.user.id, title: '물 주기', dueDate: new Date(Date.now() + DAY), repeat: 'DAILY' } });
      const action = (await api().post('/api/assistant/actions').set(auth()).send({ kind: 'task_complete', targetId: task.id }).expect(201)).body;
      await api().post(`/api/assistant/actions/${action.id}/confirm`).set(auth()).expect(201);
      expect(await db.task.count({ where: { userId: a.user.id, title: '물 주기', completed: false } })).toBe(1);
    });
  });

  describe('아침 브리핑', () => {
    const briefings = (user = a) => db.notification.findMany({ where: { userId: user.user.id, targetType: 'BRIEFING' } });
    it('정한 시각 뒤 처음 확인할 때 하루 한 번, AI가 쓴 3줄을 알림함에 넣는다', async () => {
      await api().patch('/api/notifications/settings').set(auth()).send({ notificationInApp: true, notificationEmail: false, briefingEnabled: true, briefingHour: 8 }).expect(200);
      await api().patch('/api/notifications/settings').set(auth(b)).send({ notificationInApp: true, notificationEmail: false, briefingEnabled: false }).expect(200);
      await api().patch('/api/notifications/settings').set(auth()).send({ notificationInApp: true, notificationEmail: false, briefingHour: 20 }).expect(400);
      const today = kst('2026-11-13T00:00');
      await db.event.create({ data: { userId: a.user.id, title: '치과', startAt: kst('2026-11-13T15:00'), endAt: kst('2026-11-13T16:00') } });
      const service = app.get(BriefingService);
      await service.tick(kst('2026-11-13T07:30'));
      expect(await briefings()).toHaveLength(0); // 아직 8시 전
      ai.complete.mockResolvedValue({ provider: 'claude-cli', demo: false, text: '- **15:00 치과** 예약이 있어요\n2줄\n3줄\n4줄은 잘린다' });
      await Promise.all([service.tick(kst('2026-11-13T08:05')), service.tick(kst('2026-11-13T08:05'))]);
      await service.tick(kst('2026-11-13T09:00'));
      const rows = await briefings();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ title: '☀️ 오늘의 브리핑', body: '15:00 치과 예약이 있어요\n2줄\n3줄', href: '/', deadlineAt: today });
      expect(await briefings(b)).toHaveLength(0); // 끈 사람은 받지 않음
      const prompt = JSON.parse(ai.complete.mock.calls.find(c => c[1] === 'briefing:morning')![2].prompt);
      expect(prompt.events.map((e: { title: string }) => e.title)).toContain('치과');
      // 마감 확인이 브리핑 알림을 지우지 않는다
      await app.get(NotificationsService).sync(kst('2026-11-13T09:01'));
      expect(await briefings()).toHaveLength(1);
      // 알림함에 보이고 누르면 홈으로
      expect((await api().get('/api/notifications').set(auth()).expect(200)).body.notifications.some((n: { title: string }) => n.title === '☀️ 오늘의 브리핑')).toBe(true);
    });

    it('저녁에 처음 켰으면 그날은 보내지 않고, AI가 없으면 규칙으로 쓴다', async () => {
      const service = app.get(BriefingService);
      await service.tick(kst('2026-11-14T19:00'));
      expect((await briefings()).filter(r => +r.deadlineAt === +kst('2026-11-14T00:00'))).toHaveLength(0);
      ai.complete.mockRejectedValue(new Error('연결 안 됨'));
      await db.task.create({ data: { userId: a.user.id, title: '세금 내기', dueDate: kst('2026-11-15T18:00') } });
      const preview = await service.compose(a.user.id, kst('2026-11-15T08:00'));
      expect(preview.ai).toBe(false);
      expect(preview.text).toContain('오늘 마감 세금 내기');
      expect((await api().post('/api/briefing/preview').set(auth()).expect(201)).body).toHaveProperty('text');
    });
  });

  describe('개발일지', () => {
    let repo: string;
    const git = (args: string[], date?: string) => execFileSync('git', ['-C', repo, ...args], { env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}), GIT_AUTHOR_NAME: 'tester', GIT_AUTHOR_EMAIL: 'tester@example.com', GIT_COMMITTER_NAME: 'tester', GIT_COMMITTER_EMAIL: 'tester@example.com' } });
    beforeAll(() => {
      repo = mkdtempSync(join(tmpdir(), 'devmata-devlog-'));
      git(['init', '-q']);
      writeFileSync(join(repo, 'login.ts'), 'export {}');
      git(['add', '.']); git(['commit', '-q', '-m', '로그인 화면 추가'], '2026-11-10T10:00:00+09:00');
      writeFileSync(join(repo, 'login.ts'), 'export const x = 1');
      git(['commit', '-q', '-am', '로그인 오류 수정\n\n비밀번호 확인 버그'], '2026-11-10T21:30:00+09:00');
      writeFileSync(join(repo, 'next.ts'), 'export {}');
      git(['add', '.']); git(['commit', '-q', '-m', '다음 날 작업'], '2026-11-11T09:00:00+09:00');
    });
    afterAll(() => rmSync(repo, { recursive: true, force: true }));

    it('PC 폴더 git 기록에서 그날 커밋만 모아 AI가 정리하고, 다시 만들면 덮어쓴다', async () => {
      const project = (await api().post('/api/projects').set(auth()).send({ name: '로그인 앱', goal: '로그인', localPath: repo }).expect(201)).body;
      ai.complete.mockResolvedValue({ provider: 'claude-cli', demo: false, text: '## 한 일\n- 로그인 화면\n## 바뀐 곳\n- login.ts\n## 다음에 할 일\n- 테스트' });
      const log = (await api().post(`/api/projects/${project.id}/devlogs`).set(auth()).send({ day: '2026-11-10' }).expect(201)).body;
      expect(log).toMatchObject({ day: '2026-11-10', commitCount: 2, provider: 'claude-cli' });
      const prompt = JSON.parse(ai.complete.mock.calls[0][2].prompt);
      expect(prompt.commits.map((c: { title: string }) => c.title)).toEqual(['로그인 화면 추가', '로그인 오류 수정']);
      expect(prompt.commits[1].files).toEqual(['login.ts']);
      await api().post(`/api/projects/${project.id}/devlogs`).set(auth()).send({ day: '2026-11-10' }).expect(201);
      expect((await api().get(`/api/projects/${project.id}/devlogs`).set(auth()).expect(200)).body).toHaveLength(1);
      // 커밋이 없는 날·앞으로 올 날·남의 프로젝트
      await api().post(`/api/projects/${project.id}/devlogs`).set(auth()).send({ day: '2026-11-09' }).expect(400);
      await api().post(`/api/projects/${project.id}/devlogs`).set(auth()).send({ day: '2999-01-01' }).expect(400);
      await api().get(`/api/projects/${project.id}/devlogs`).set(auth(b)).expect(404);
      // AI가 없으면 커밋 제목 목록으로
      ai.complete.mockRejectedValue(new Error('연결 안 됨'));
      const plain = (await api().post(`/api/projects/${project.id}/devlogs`).set(auth()).send({ day: '2026-11-11' }).expect(201)).body;
      expect(plain).toMatchObject({ provider: 'none', commitCount: 1 });
      expect(plain.content).toContain('다음 날 작업');
      // 자동: 이미 있는 날은 건너뛴다
      expect(await app.get(DevLogService).autoForDay(a.user.id, '2026-11-11')).toBe(0);
      await api().delete(`/api/projects/${project.id}/devlogs/${plain.id}`).set(auth()).expect(200);
      expect(await app.get(DevLogService).autoForDay(a.user.id, '2026-11-11')).toBe(1);
    });
  });
});

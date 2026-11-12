import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { monthBefore } from '../src/notifications/deadline.logic';

describe('deadline notifications', () => {
  let app: INestApplication;
  let a: { user: { id: string }; accessToken: string }, b: typeof a;
  const api = () => request(app.getHttpServer());
  const db = () => app.get(PrismaService);
  const service = () => app.get(NotificationsService);
  const auth = (account = a) => ({ Authorization: `Bearer ${account.accessToken}` });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(MailService).useValue({ configured: false }).compile();
    app = module.createNestApplication(); configureApp(app); await app.init();
    a = (await api().post('/api/auth/register').send({ email: 'notification-a@test.com', name: '알림 A', password: 'password123' }).expect(201)).body;
    b = (await api().post('/api/auth/register').send({ email: 'notification-b@test.com', name: '알림 B', password: 'password123' }).expect(201)).body;
  });
  afterAll(async () => { await db().user.deleteMany({ where: { id: { in: [a.user.id, b.user.id] } } }); await app.close(); });
  it('한 달·3주·1주·하루 전 알림은 각 한 번, 반복·동시 처리에도 중복 없음', async () => {
    const due = new Date(Date.now() + 40 * 86400000);
    const task = await db().task.create({ data: { userId: a.user.id, title: '보고서', dueDate: due } });
    for (const now of [monthBefore(due), new Date(+due - 21 * 86400000), new Date(+due - 7 * 86400000), new Date(+due - 86400000)]) await Promise.all([service().sync(now), service().sync(now)]);
    const rows = await db().notification.findMany({ where: { targetId: task.id } });
    expect(rows.map(row => row.milestone).sort()).toEqual(['DAY', 'MONTH', 'THREE_WEEKS', 'WEEK']);
    const list = await api().get('/api/notifications').set(auth()).expect(200);
    expect(list.body.notifications).toHaveLength(4);
    expect(list.body.unreadCount).toBe(4);
    expect((await api().get('/api/notifications').set(auth(b)).expect(200)).body.notifications).toEqual([]);
    await api().patch(`/api/notifications/${rows[0].id}/read`).set(auth(b)).send({}).expect(404);
    await api().patch(`/api/notifications/${rows[0].id}/read`).set(auth()).send({}).expect(200);
    expect((await api().get('/api/notifications').set(auth()).expect(200)).body.unreadCount).toBe(3);
    await api().post('/api/notifications/read-all').set(auth()).expect(201);
    expect((await api().get('/api/notifications').set(auth()).expect(200)).body.unreadCount).toBe(0);
    // Changed dates invalidate the old reminders.
    await db().task.update({ where: { id: task.id }, data: { dueDate: new Date(+due + 60 * 86400000) } });
    await service().sync();
    expect(await db().notification.count({ where: { targetId: task.id } })).toBe(0);
  });
  it('놓친 알림은 현재 단계 하나만, 완료·삭제된 대상은 정리', async () => {
    const due = new Date(Date.now() + 12 * 3600000);
    const task = await db().task.create({ data: { userId: a.user.id, title: '내일 제출', dueDate: due } });
    const event = await db().event.create({ data: { userId: a.user.id, title: '일정 마감', startAt: new Date(), endAt: due } });
    await service().sync();
    expect(await db().notification.count({ where: { targetId: task.id, milestone: 'DAY' } })).toBe(1);
    expect(await db().notification.count({ where: { targetId: event.id } })).toBe(1);
    await db().task.update({ where: { id: task.id }, data: { completed: true } });
    await db().event.delete({ where: { id: event.id } });
    await service().sync();
    expect(await db().notification.count({ where: { targetId: { in: [task.id, event.id] } } })).toBe(0);
  });
  it('꺼져 있던 사이 마감이 지난 할 일은 켜졌을 때 "마감 지남" 한 번 (일정·오래된 할 일·완료한 할 일은 제외)', async () => {
    const ago = (hours: number) => new Date(Date.now() - hours * 3600000);
    const missed = await db().task.create({ data: { userId: a.user.id, title: '어제 마감', dueDate: ago(20) } });
    const old = await db().task.create({ data: { userId: a.user.id, title: '오래전 마감', dueDate: ago(24 * 5) } });
    const done = await db().task.create({ data: { userId: a.user.id, title: '끝낸 일', dueDate: ago(20), completed: true } });
    const ended = await db().event.create({ data: { userId: a.user.id, title: '끝난 일정', startAt: ago(3), endAt: ago(1) } });
    await Promise.all([service().sync(), service().sync()]);
    await service().sync();
    const rows = await db().notification.findMany({ where: { targetId: { in: [missed.id, old.id, done.id, ended.id] } } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ targetId: missed.id, milestone: 'OVERDUE', title: '할 일 마감 지남' });
    await db().task.update({ where: { id: missed.id }, data: { completed: true } });
    await service().sync();
    expect(await db().notification.count({ where: { targetId: missed.id } })).toBe(0);
  });
  it('지운 알림은 다시 확인해도 돌아오지 않고, 본인 알림만 지울 수 있음', async () => {
    await service().sync();
    await api().delete('/api/notifications').set(auth()).expect(200);
    const soon = (hours: number) => new Date(Date.now() + hours * 3600000);
    const first = await db().task.create({ data: { userId: a.user.id, title: '지울 알림', dueDate: soon(5) } });
    const second = await db().task.create({ data: { userId: a.user.id, title: '남길 알림', dueDate: soon(6) } });
    await service().sync();
    const rows = await db().notification.findMany({ where: { targetId: { in: [first.id, second.id] } } });
    const row = rows.find(r => r.targetId === first.id)!;
    await api().delete(`/api/notifications/${row.id}`).set(auth(b)).expect(404);
    await api().delete(`/api/notifications/${row.id}`).set(auth()).expect(200);
    await api().delete(`/api/notifications/${row.id}`).set(auth()).expect(404);
    await service().sync();
    let list = (await api().get('/api/notifications').set(auth()).expect(200)).body;
    expect(list.notifications.map((n: { body: string }) => n.body.split(' · ')[0])).toEqual(['남길 알림']);
    expect(list.unreadCount).toBe(1);
    expect(await db().notification.count({ where: { targetId: first.id } })).toBe(1);
    // 마감을 바꾸면 새 알림으로 다시 온다
    await db().task.update({ where: { id: first.id }, data: { dueDate: soon(7) } });
    await service().sync();
    list = (await api().get('/api/notifications').set(auth()).expect(200)).body;
    expect(list.notifications).toHaveLength(2);
    expect((await api().delete('/api/notifications').set(auth()).expect(200)).body.count).toBe(2);
    await service().sync();
    list = (await api().get('/api/notifications').set(auth()).expect(200)).body;
    expect(list).toEqual({ notifications: [], unreadCount: 0 });
    await api().delete('/api/notifications').expect(401);
  });
  it('알림 설정은 본인에게만 적용되고 인증·불필요한 필드는 차단', async () => {
    await api().get('/api/notifications').expect(401);
    await api().patch('/api/notifications/settings').set(auth()).send({ notificationInApp: false, notificationEmail: true }).expect(200);
    expect((await api().get('/api/notifications/settings').set(auth()).expect(200)).body).toMatchObject({ notificationInApp: false, notificationEmail: true, emailConfigured: false });
    expect((await api().get('/api/notifications/settings').set(auth(b)).expect(200)).body.notificationInApp).toBe(true);
    await api().patch('/api/notifications/settings').set(auth()).send({ notificationInApp: true, notificationEmail: true, userId: b.user.id }).expect(400);
  });
});

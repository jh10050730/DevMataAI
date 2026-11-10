import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { deadlineMilestone, eventDeadline } from './deadline.logic';
import { desktopToastEnabled, showDesktopToast } from './desktop-toast';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private mailing?: Promise<void>;
  constructor(private readonly db: PrismaService, private readonly mail: MailService) {}
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const tick = () => { void this.sync().catch(() => Logger.warn('마감 알림 처리 실패. 다음 주기에 다시 시도합니다.', 'Notifications')); };
    this.timer = setInterval(tick, 60000); this.timer.unref(); tick();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  sync(now = new Date()) {
    if (!this.running) this.running = this.collect(now).finally(() => { this.running = undefined; });
    return this.running;
  }
  private async collect(now: Date) {
    const [tasks, events, existing] = await Promise.all([
      this.db.task.findMany({ where: { completed: false, dueDate: { not: null } }, select: { id: true, userId: true, title: true, dueDate: true } }),
      this.db.event.findMany({ select: { id: true, userId: true, title: true, endAt: true, allDay: true } }),
      this.db.notification.findMany({ select: { id: true, targetType: true, targetId: true, deadlineAt: true, milestone: true } }),
    ]);
    const targets = [
      ...tasks.map(task => ({ id: task.id, userId: task.userId, title: task.title, deadline: task.dueDate!, type: 'TASK', href: '/calendar' })),
      ...events.map(event => ({ id: event.id, userId: event.userId, title: event.title, deadline: eventDeadline(event), type: 'EVENT', href: '/calendar' })),
    ];
    const targetMap = new Map(targets.map(target => [target.type + ':' + target.id, target]));
    const stale = existing.filter(row => targetMap.get(row.targetType + ':' + row.targetId)?.deadline.getTime() !== row.deadlineAt.getTime());
    if (stale.length) await this.db.notification.deleteMany({ where: { id: { in: stale.map(row => row.id) } } });
    const known = new Set(existing.map(row => [row.targetType, row.targetId, row.deadlineAt.getTime(), row.milestone].join(':')));
    const fresh: { userId: string; title: string; body: string; href: string }[] = [];
    for (const target of targets) {
      const stage = deadlineMilestone(target.deadline, now);
      if (!stage) continue;
      const deadlineText = target.deadline.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
      const title = `${target.type === 'TASK' ? '할 일' : '일정'} 마감 ${stage.label}`;
      const body = `${target.title} · 마감 ${deadlineText} (한국 시간)`;
      await this.db.notification.upsert({
        where: { targetType_targetId_deadlineAt_milestone: { targetType: target.type, targetId: target.id, deadlineAt: target.deadline, milestone: stage.key } },
        create: { userId: target.userId, targetType: target.type, targetId: target.id, deadlineAt: target.deadline, milestone: stage.key, title, body, href: target.href, createdAt: now },
        update: { title, body },
      });
      if (!known.has([target.type, target.id, target.deadline.getTime(), stage.key].join(':'))) fresh.push({ userId: target.userId, title, body, href: target.href });
    }
    if (fresh.length) void this.toast(fresh).catch(() => Logger.warn('바탕화면 알림 표시 실패.', 'Notifications'));
    // SMTP must not delay opening the in-app notification list.
    if (this.mail.configured && !this.mailing) this.mailing = this.sendPending(now).catch(() => Logger.warn('메일 알림 큐 처리 실패.', 'Notifications')).finally(() => { this.mailing = undefined; });
  }
  /** 새로 생긴 알림을 Windows 바탕화면 알림으로 띄운다 (앱 내 알림을 끈 사용자는 제외, 한 번에 최대 3개). */
  private async toast(fresh: { userId: string; title: string; body: string; href: string }[]) {
    if (!desktopToastEnabled()) return;
    const muted = new Set((await this.db.user.findMany({ where: { id: { in: [...new Set(fresh.map(row => row.userId))] }, notificationInApp: false }, select: { id: true } })).map(user => user.id));
    const rows = fresh.filter(row => !muted.has(row.userId));
    for (const row of rows.slice(0, 3)) await showDesktopToast(row.title, row.body, this.link(row.href));
    if (rows.length > 3) await showDesktopToast('마감 알림', `외 ${rows.length - 3}건의 마감 알림이 있습니다.`, this.link('/calendar'));
  }
  private link(href: string) { try { return this.mail.publicUrl(href).href; } catch { return undefined; } }
  private async stillCurrent(row: { userId: string; targetType: string; targetId: string; deadlineAt: Date }) {
    if (row.targetType === 'TASK') {
      const task = await this.db.task.findFirst({ where: { id: row.targetId, userId: row.userId, completed: false } });
      return task?.dueDate?.getTime() === row.deadlineAt.getTime();
    }
    const event = await this.db.event.findFirst({ where: { id: row.targetId, userId: row.userId } });
    return !!event && eventDeadline(event).getTime() === row.deadlineAt.getTime();
  }
  private async sendPending(now: Date) {
    const pending = await this.db.notification.findMany({ where: { emailSentAt: null, emailAttempts: { lt: 3 }, deadlineAt: { gt: now }, user: { notificationEmail: true }, OR: [{ nextEmailAttemptAt: null }, { nextEmailAttemptAt: { lte: now } }] }, include: { user: { select: { email: true } } }, orderBy: { createdAt: 'desc' }, take: 20 });
    for (const row of pending) {
      if (deadlineMilestone(row.deadlineAt, now)?.key !== row.milestone || !(await this.stillCurrent(row))) continue;
      // Claim before sending: prevents simultaneous scheduler instances sending the same row.
      const lease = new Date(now.getTime() + 15 * 60000);
      const claimed = await this.db.notification.updateMany({ where: { id: row.id, emailSentAt: null, emailAttempts: row.emailAttempts, OR: [{ nextEmailAttemptAt: null }, { nextEmailAttemptAt: { lte: now } }] }, data: { emailAttempts: { increment: 1 }, nextEmailAttemptAt: lease } });
      if (!claimed.count) continue;
      try {
        await this.mail.send(row.user.email, `[DevMata AI] ${row.title}`, `${row.body}\n\n${this.mail.publicUrl(row.href).href}\n\n알림 설정은 DevMata AI 설정 화면에서 바꿀 수 있습니다.`);
        await this.db.notification.updateMany({ where: { id: row.id }, data: { emailSentAt: new Date(), nextEmailAttemptAt: null } });
      } catch { Logger.warn('마감 알림 메일 발송 실패. 최대 3회 재시도합니다.', 'Notifications'); }
    }
  }
  async settings(userId: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { notificationInApp: true, notificationEmail: true } });
    return { ...user, emailConfigured: this.mail.configured, notice: '할 일 마감일·일정 종료 기준 한 달 전, 3주 전, 1주 전, 하루 전에 알립니다. 서버 실행 중 1분마다 확인하며, 놓친 알림은 현재 가장 가까운 단계 한 건만 생성합니다.', desktopEnabled: desktopToastEnabled() };
  }
  async updateSettings(userId: string, data: { notificationInApp: boolean; notificationEmail: boolean }) {
    await this.db.user.update({ where: { id: userId }, data });
    return this.settings(userId);
  }
  async list(userId: string) {
    await this.sync();
    const preferences = await this.settings(userId);
    if (!preferences.notificationInApp) return { notifications: [], unreadCount: 0 };
    const [notifications, unreadCount] = await Promise.all([
      this.db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, title: true, body: true, href: true, readAt: true, createdAt: true } }),
      this.db.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { notifications, unreadCount };
  }
  async read(userId: string, id: string) {
    const result = await this.db.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    if (!result.count) throw new NotFoundException('알림을 찾을 수 없습니다.');
    return { id };
  }
  async readAll(userId: string) { await this.db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } }); return { success: true }; }
}

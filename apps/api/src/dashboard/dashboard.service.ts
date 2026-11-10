import { Injectable } from '@nestjs/common';
import { CalendarService } from '../calendar/calendar.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';

const DAY = 86_400_000;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly calendar: CalendarService,
  ) {}

  /**
   * 오늘의 요약. "오늘"의 경계는 사용자 시간대가 기준이므로
   * 프론트엔드가 로컬 자정(from)과 다음 날 자정(to)을 보낸다.
   */
  async today(userId: string, from: Date, to: Date) {
    const soon = new Date(to.getTime() + 2 * DAY); // 마감 임박: 오늘 + 2일

    const [todayEvents, openTasks, stats, upcomingEvents] = await Promise.all([
      this.calendar.list(userId, { from, to }),
      this.prisma.task.findMany({ where: { userId, completed: false } }),
      this.tasks.stats(userId),
      this.calendar.upcoming(userId, 7, 5),
    ]);

    const sorted = openTasks.sort(TasksService.compare);
    const overdue = sorted.filter((t) => t.dueDate && t.dueDate < from);
    const dueToday = sorted.filter((t) => t.dueDate && t.dueDate >= from && t.dueDate < to);
    const dueSoon = sorted.filter((t) => t.dueDate && t.dueDate >= to && t.dueDate < soon);

    return {
      range: { from, to },
      todayEvents,
      upcomingEvents,
      tasks: { overdue, dueToday, dueSoon, openCount: openTasks.length },
      stats,
    };
  }

  /**
   * 새로 설치한 사람을 위한 "처음 해 볼 일" 진행 상황.
   * AI 연결은 PC 단위(이 PC 의 Claude/ChatGPT 계정)라 사용자와 관계없이 실제 AI 호출 성공이 한 번이라도 있으면 완료로 본다.
   */
  async gettingStarted(userId: string) {
    const [ai, task, event, note, project, google] = await Promise.all([
      this.prisma.aiUsageLog.count({ where: { success: true, provider: { not: 'demo' } }, take: 1 }),
      this.prisma.task.count({ where: { userId }, take: 1 }),
      this.prisma.event.count({ where: { userId, source: 'LOCAL' }, take: 1 }),
      this.prisma.studyNote.count({ where: { userId }, take: 1 }),
      this.prisma.project.count({ where: { userId }, take: 1 }),
      this.prisma.integration.count({ where: { userId, provider: 'GOOGLE_CALENDAR', status: 'CONNECTED' }, take: 1 }),
    ]);
    return { ai: ai > 0, task: task > 0, event: event > 0, note: note > 0, project: project > 0, google: google > 0 };
  }
}

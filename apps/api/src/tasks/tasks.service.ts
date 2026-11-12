import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CATEGORIES, PRIORITY_WEIGHT } from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from './tasks.dto';
import { assertRepeatable, spawnNextTask } from './task-repeat';

type Sortable = { completed: boolean; dueDate: Date | null; priority: string; createdAt: Date };

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: TaskQueryDto) {
    const where: Prisma.TaskWhereInput = { userId };
    if (query.status === 'active') where.completed = false;
    if (query.status === 'completed') where.completed = true;
    if (query.category) where.category = query.category;
    const tasks = await this.prisma.task.findMany({ where });
    return tasks.sort(TasksService.compare);
  }

  /** 미완료 우선 → 마감일 빠른 순(없으면 뒤) → 중요도 높은 순 → 최신순 */
  static compare(a: Sortable, b: Sortable) {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const ad = a.dueDate?.getTime() ?? Infinity;
    const bd = b.dueDate?.getTime() ?? Infinity;
    if (ad !== bd) return ad - bd;
    const pw = (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
    if (pw !== 0) return pw;
    return b.createdAt.getTime() - a.createdAt.getTime();
  }

  create(userId: string, dto: CreateTaskDto) {
    assertRepeatable(dto.repeat, dto.dueDate);
    return this.prisma.task.create({ data: { ...dto, userId } });
  }

  /** 반복 할 일을 끝내면 다음 마감일로 새 할 일을 만든다 (next 로 돌려준다) */
  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const existing = await this.findOwned(userId, id);
    assertRepeatable(dto.repeat === undefined ? existing.repeat : dto.repeat, dto.dueDate === undefined ? existing.dueDate : dto.dueDate);
    const data: Prisma.TaskUpdateInput = { ...dto };
    const completing = dto.completed === true && !existing.completed;
    if (dto.completed !== undefined && dto.completed !== existing.completed) {
      data.completedAt = dto.completed ? new Date() : null;
    }
    return this.prisma.$transaction(async tx => {
      const task = await tx.task.update({ where: { id }, data });
      const next = completing ? await spawnNextTask(tx, task) : null;
      return next ? { ...task, next } : task;
    });
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.task.delete({ where: { id } });
    return { id };
  }

  /** 진행률 = 완료한 할 일 / 전체 할 일 (전체 + 카테고리별) */
  async stats(userId: string) {
    const groups = await this.prisma.task.groupBy({
      by: ['category', 'completed'],
      where: { userId },
      _count: { _all: true },
    });
    const count = (pred: (g: (typeof groups)[number]) => boolean) =>
      groups.filter(pred).reduce((s, g) => s + g._count._all, 0);
    const rate = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

    const byCategory = CATEGORIES.map((category) => {
      const total = count((g) => g.category === category);
      const done = count((g) => g.category === category && g.completed);
      return { category, total, done, rate: rate(done, total) };
    });
    const total = count(() => true);
    const done = count((g) => g.completed);
    return { total, done, rate: rate(done, total), byCategory };
  }

  /** 다른 사용자의 데이터는 존재하지 않는 것처럼 404 */
  private async findOwned(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) throw new NotFoundException('할 일을 찾을 수 없습니다.');
    return task;
  }
}

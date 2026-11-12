import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { isRepeat, nextOccurrence } from '../common/recurrence';

type TaskRow = { userId: string; title: string; description: string | null; priority: string; category: string; dueDate: Date | null; repeat: string | null };

/** 반복 할 일은 마감일이 있어야 다음 마감일을 셀 수 있다 */
export function assertRepeatable(repeat: string | null | undefined, dueDate: Date | null | undefined) {
  if (repeat && !dueDate) throw new BadRequestException('반복 할 일은 마감일이 필요해요.');
}

/**
 * 반복 할 일을 끝내면 다음 마감일로 같은 할 일을 하나 만든다.
 * 완료를 취소했다가 다시 끝내도 두 번 만들지 않도록, 같은 할 일이 이미 있으면 건너뛴다.
 */
export async function spawnNextTask(db: Prisma.TransactionClient | { task: Prisma.TransactionClient['task'] }, task: TaskRow, now = new Date()) {
  if (!isRepeat(task.repeat) || !task.dueDate) return null;
  const dueDate = nextOccurrence(task.dueDate, task.repeat, new Date(Math.max(now.getTime(), task.dueDate.getTime())));
  const exists = await db.task.findFirst({ where: { userId: task.userId, title: task.title, repeat: task.repeat, completed: false, dueDate }, select: { id: true } });
  if (exists) return null;
  return db.task.create({ data: { userId: task.userId, title: task.title, description: task.description, priority: task.priority, category: task.category, repeat: task.repeat, dueDate } });
}

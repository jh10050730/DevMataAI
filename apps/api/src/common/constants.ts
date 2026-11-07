export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const CATEGORIES = ['GENERAL', 'STUDY', 'DEV', 'SCHOOL', 'PERSONAL'] as const;
export type Category = (typeof CATEGORIES)[number];

/** 우선순위 정렬용 가중치 */
export const PRIORITY_WEIGHT: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

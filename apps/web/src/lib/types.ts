export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type Category = 'GENERAL' | 'STUDY' | 'DEV' | 'SCHOOL' | 'PERSONAL';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  category: Category;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  /** 반복 (완료하면 다음 마감일로 새 할 일이 생긴다) */
  repeat?: Repeat | null;
  isDemo?: boolean;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string | null;
  category: Category;
  source: string;
  repeat?: Repeat | null;
  repeatUntil?: string | null;
  /** 반복 일정의 회차일 때: 원래(첫 회차) 시작·종료. 수정은 반복 전체에 적용된다 */
  series?: { startAt: string; endAt: string };
  isDemo?: boolean;
}

export interface TaskStats {
  total: number;
  done: number;
  rate: number;
  byCategory: { category: Category; total: number; done: number; rate: number }[];
}

export interface DashboardToday {
  todayEvents: CalendarEvent[];
  upcomingEvents: CalendarEvent[];
  tasks: { overdue: Task[]; dueToday: Task[]; dueSoon: Task[]; openCount: number };
  stats: TaskStats;
}

export const PRIORITY_LABEL: Record<Priority, string> = { LOW: '낮음', MEDIUM: '보통', HIGH: '높음', URGENT: '긴급' };
export const PRIORITY_STYLE: Record<Priority, string> = {
  LOW: 'bg-slate-500/15 text-slate-500 dark:text-slate-400',
  MEDIUM: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  HIGH: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  URGENT: 'bg-red-500/15 text-red-600 dark:text-red-400',
};
export const CATEGORY_LABEL: Record<Category, string> = {
  GENERAL: '일반',
  STUDY: '공부',
  DEV: '개발',
  SCHOOL: '학교',
  PERSONAL: '개인',
};
export const CATEGORY_COLOR: Record<Category, string> = {
  GENERAL: '#64748b',
  STUDY: '#8b5cf6',
  DEV: '#3b82f6',
  SCHOOL: '#10b981',
  PERSONAL: '#f59e0b',
};
export const PRIORITIES = Object.keys(PRIORITY_LABEL) as Priority[];
export const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export type Repeat = 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'MONTHLY';
export const REPEAT_LABEL: Record<Repeat, string> = { DAILY: '매일', WEEKDAYS: '평일마다', WEEKLY: '매주', MONTHLY: '매월' };
export const REPEATS = Object.keys(REPEAT_LABEL) as Repeat[];

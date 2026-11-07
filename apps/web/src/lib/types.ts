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

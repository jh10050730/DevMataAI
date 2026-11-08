import { api } from './api';

export interface StudySubject {
  id: string;
  name: string;
  color: string;
}

export interface StudyNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  progress: number;
  subjectId: string | null;
  subject: StudySubject | null;
  lastStudiedAt: string | null;
  nextReviewAt: string | null;
  reviewCount: number;
  reviewDue: boolean;
  notionPageId: string | null;
  notionSavedAt: string | null;
  isDemo?: boolean;
  updatedAt: string;
}

export interface StudyOverview {
  total: number;
  due: number;
  tags: string[];
  subjects: (Omit<StudySubject, 'id'> & { id: string | null; total: number; completed: number; due: number; progress: number })[];
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type AiAction = 'summary' | 'explain' | 'terms' | 'quiz-choice' | 'quiz-short' | 'ask';

export interface AiResult {
  action: AiAction;
  text: string;
  provider: string;
  model?: string;
  demo: boolean;
}

export interface NoteInput {
  title: string;
  content: string;
  subjectId: string | null;
  tags: string[];
}

export const RATING_LABEL: Record<Rating, string> = { again: '다시', hard: '어려움', good: '보통', easy: '쉬움' };

export const AI_ACTIONS: { action: AiAction; label: string }[] = [
  { action: 'summary', label: '요약' },
  { action: 'explain', label: '쉽게 설명' },
  { action: 'terms', label: '핵심 용어' },
  { action: 'quiz-choice', label: '객관식 문제' },
  { action: 'quiz-short', label: '주관식 문제' },
];

export const studyApi = {
  overview: () => api.get<StudyOverview>('/study/overview'),
  subjects: () => api.get<StudySubject[]>('/study/subjects'),
  createSubject: (name: string, color?: string) => api.post<StudySubject>('/study/subjects', { name, color }),
  deleteSubject: (id: string) => api.delete(`/study/subjects/${id}`),
  notes: (f: { q?: string; subjectId?: string; tag?: string; due?: boolean }) => {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    if (f.subjectId) p.set('subjectId', f.subjectId);
    if (f.tag) p.set('tag', f.tag);
    if (f.due) p.set('due', 'true');
    return api.get<StudyNote[]>(`/study/notes?${p}`);
  },
  note: (id: string) => api.get<StudyNote>(`/study/notes/${id}`),
  create: (n: NoteInput) => api.post<StudyNote>('/study/notes', n),
  update: (id: string, n: Partial<NoteInput> & { progress?: number }) => api.patch<StudyNote>(`/study/notes/${id}`, n),
  remove: (id: string) => api.delete(`/study/notes/${id}`),
  studied: (id: string, rating: Rating, progress: number) => api.post<StudyNote>(`/study/notes/${id}/studied`, { rating, progress }),
  ai: (id: string, action: AiAction, question?: string) => api.post<AiResult>(`/study/notes/${id}/ai`, { action, question }),
  importNotion: (page: string, subjectId?: string) =>
    api.post<{ noteId: string; created: boolean; skippedBlocks: number; truncated: boolean }>('/study/notion/import', { page, subjectId }),
  exportNotion: (id: string, replace = false) =>
    api.post<{ status: 'created' | 'updated' | 'unchanged'; url?: string }>(`/study/notes/${id}/notion`, { replace }),
};

export interface IntegrationStatus {
  ai: { provider: string; demo: boolean; ok: boolean; detail: string; last24h: { calls: number; failures: number } };
  notion: { configured: boolean; ok: boolean; detail: string; canExport: boolean };
  github: { configured: boolean; detail: string };
  googleCalendar: { configured: boolean; detail: string };
}
export const getIntegrationStatus = () => api.get<IntegrationStatus>('/integrations/status');

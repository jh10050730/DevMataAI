export const newsCategories: Record<string, string> = {
  IT: 'IT 전체', AI: 'AI', SECURITY: '보안', DEV: '개발', TECH: '기술',
  ECONOMY: '경제', FINANCE: '금융·증권', REAL_ESTATE: '부동산', WORLD: '국제', POLITICS: '정치', SOCIETY: '사회',
};
export type ArticleSummary = { available: boolean; summary?: string; sourceUrl?: string; message?: string };
export type NewsSource = { id: string; title: string; source: string; url: string; excerpt: string; bodyStatus?: 'read' | 'unavailable'; bodyMessage?: string; summary?: string; sourceUrl?: string; articleSummary?: ArticleSummary | null };
export type NewsAnalysis = {
  available: boolean;
  message?: string;
  notice?: string;
  summary?: string[];
  sourceArticles?: NewsSource[];
  generatedAt?: string;
};
export type NewsBriefing = {
  date: string;
  articles: NewsSource[];
  analysis?: NewsAnalysis | null;
};

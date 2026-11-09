import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import type { ArticleSummary, NewsSource } from '../lib/news';
import { Button } from './ui';

export default function ArticleExcerpt({ article, compact = false }: { article: NewsSource; compact?: boolean }) {
  const [result, setResult] = useState<ArticleSummary>();
  const [loading, setLoading] = useState(false);
  const initial = article.summary ? { available: true, summary: article.summary, sourceUrl: article.sourceUrl } : article.articleSummary;
  const value = initial?.available ? initial : result ?? initial;
  async function summarize() {
    setLoading(true);
    try { setResult(await api.post<ArticleSummary>(`/news/${encodeURIComponent(article.id)}/summary`)); }
    catch (e) { setResult({ available: false, message: errorMessage(e) }); }
    finally { setLoading(false); }
  }
  if (value?.available && value.summary) return <div className="mt-2 text-sm leading-relaxed">
    <p>{value.summary}</p><p className="mt-1 text-xs text-muted">원문 기반 AI 요약{value.sourceUrl && <> · <a href={value.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">읽은 원문 ↗</a></>}</p>
  </div>;
  if (article.excerpt.trim()) return <p className={`mt-2 text-sm leading-relaxed text-muted ${compact ? 'line-clamp-2' : 'line-clamp-4'}`}>{article.excerpt}</p>;
  return <div className="mt-2 space-y-2">
    <p className="text-xs text-muted" role="status">{loading ? '원문을 읽고 Claude가 요약하고 있습니다…' : value?.message || article.bodyMessage || '발췌가 없는 기사입니다. 원문을 읽어 요약할 수 있습니다.'}</p>
    <Button variant="secondary" className="text-xs" loading={loading} onClick={() => void summarize()}>{value?.message || article.bodyMessage ? '원문 요약 다시 시도' : '원문 읽고 요약'}</Button>
  </div>;
}

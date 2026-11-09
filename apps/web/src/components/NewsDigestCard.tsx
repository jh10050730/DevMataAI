import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { newsCategories, type NewsAnalysis, type NewsBriefing } from '../lib/news';
import { Badge, Button, Card, EmptyState, ErrorState, Select, Spinner } from './ui';
import ArticleExcerpt from './ArticleExcerpt';

export default function NewsDigestCard() {
  const [category, setCategory] = useState('');
  const [revision, setRevision] = useState(0);
  const [briefing, setBriefing] = useState<NewsBriefing>();
  const [analysis, setAnalysis] = useState<NewsAnalysis>();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const query = category ? `?category=${encodeURIComponent(category)}` : '';

  useEffect(() => {
    const current = ++generation.current;
    setLoading(true); setBriefing(undefined); setAnalysis(undefined); setError('');
    api.get<NewsBriefing>(`/news/briefing${query}`)
      .then(data => { if (generation.current === current) { setBriefing(data); setAnalysis(data.analysis ?? undefined); } })
      .catch(e => { if (generation.current === current) setError(errorMessage(e)); })
      .finally(() => { if (generation.current === current) setLoading(false); });
    return () => { generation.current++; };
  }, [query, revision]);

  async function summarize() {
    const current = generation.current;
    setAnalyzing(true); setError('');
    try {
      const result = await api.post<NewsAnalysis>(`/news/briefing/analyze${query}`);
      if (generation.current === current) {
        setAnalysis(result);
        if (!result.available) setError(result.message || '요약을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } catch (e) { if (generation.current === current) setError(errorMessage(e)); }
    finally { if (generation.current === current) setAnalyzing(false); }
  }

  const hasSummary = analysis?.available && !!analysis.summary?.length;
  const articles = hasSummary ? analysis.sourceArticles ?? briefing?.articles ?? [] : briefing?.articles ?? [];
  return <Card title="오늘의 뉴스 요약" icon={Newspaper} action={<Link to="/news" className="text-xs font-medium text-accent hover:underline">전체 뉴스 보기 →</Link>}>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Select aria-label="뉴스 요약 분야" className="sm:max-w-44" value={category} disabled={analyzing} onChange={e => setCategory(e.target.value)}>
        <option value="">전체 분야</option>
        {Object.entries(newsCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </Select>
      <Button variant="secondary" disabled={loading || analyzing} aria-label="뉴스 요약 새로고침" onClick={() => setRevision(v => v + 1)}><RefreshCw className="size-4" /></Button>
      <Button loading={analyzing} disabled={loading || !briefing?.articles.length || !!hasSummary} onClick={() => void summarize()}>{hasSummary ? 'AI 요약 준비됨' : 'AI 요약 만들기'}</Button>
    </div>
    {error && <div className="mb-3"><ErrorState message={error} onRetry={loading || analyzing ? undefined : () => setRevision(v => v + 1)} /></div>}
    {loading ? <Spinner /> : briefing && <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge className="bg-accent/10 text-accent">{hasSummary ? 'AI 요약' : 'RSS 발췌'}</Badge>
        <span>{category ? newsCategories[category] : '전체 분야'} · {briefing.date} 한국 시간 · 최신 {articles.length}건</span>
        {hasSummary && analysis.generatedAt && <span>생성 {new Date(analysis.generatedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
      {hasSummary && <><ul className="mb-3 space-y-2 rounded-xl bg-surface-2 p-4 text-sm leading-relaxed">{analysis.summary!.map((line, i) => <li key={i} className="flex gap-2"><span aria-hidden="true" className="text-accent">•</span><span>{line}</span></li>)}</ul><p className="mb-4 text-xs text-muted">{analysis.notice}</p></>}
      {!articles.length ? <EmptyState icon={Newspaper} title="오늘 수집된 뉴스가 없습니다" description="다른 분야를 선택하거나 뉴스 화면에서 최신 기사를 수집해 주세요." action={<Link to="/news" className="text-sm text-accent">뉴스 수집하러 가기 →</Link>} /> : <div className="space-y-3">
        {hasSummary && <p className="text-xs font-medium text-muted">요약에 사용한 기사</p>}
        {articles.map(article => <article key={article.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-accent">{article.title} <ExternalLink className="inline size-3" /></a>
          {(!hasSummary || !article.excerpt.trim()) && <ArticleExcerpt article={article} compact />}
          <p className="mt-1 text-xs text-muted">{article.source}</p>
        </article>)}
      </div>}
    </>}
  </Card>;
}

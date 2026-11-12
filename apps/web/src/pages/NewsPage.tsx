import { useEffect, useState } from 'react';
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Select, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { newsCategories as categories, type NewsSource } from '../lib/news';
import ArticleExcerpt from '../components/ArticleExcerpt';

type Article = NewsSource & { category: string; publishedAt: string | null };
type Briefing = { date: string; notice: string; articles: Article[]; lines: string[]; analysis?: Analysis | null };
type Analysis = { available: boolean; message?: string; notice?: string; summary?: string[]; sourceArticles?: NewsSource[]; articles?: { id: string; importance: string; impact: string }[] };
export default function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [briefing, setBriefing] = useState<Briefing>();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [version, setVersion] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis>();
  const [analyzing, setAnalyzing] = useState(false);
  const [schedule, setSchedule] = useState<{ enabled: boolean; notice: string; lastAttemptAt: string | null; completedDay: string | null }>();
  async function analyze() {
    setAnalyzing(true);
    try { setAnalysis(await api.post<Analysis>(`/news/briefing/analyze${category ? '?category=' + category : ''}`)); }
    catch (e) { setAnalysis({ available: false, message: errorMessage(e) }); }
    finally { setAnalyzing(false); }
  }
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      const query = new URLSearchParams({ q, ...(category ? { category } : {}) });
      Promise.all([api.get<{ articles: Article[]; total: number }>(`/news?${query}`), api.get<Briefing>(`/news/briefing${category ? '?category=' + category : ''}`), api.get<NonNullable<typeof schedule>>('/news/schedule')])
        .then(([list, brief, auto]) => { if (active) { setArticles(list.articles); setTotal(list.total); setBriefing(brief); setAnalysis(brief.analysis ?? undefined); setSchedule(auto); } })
        .catch(e => { if (active) setError(errorMessage(e)); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [q, category, version]);
  async function refresh() {
    setRefreshing(true); setStatus(''); setError(''); setAnalysis(undefined);
    try {
      const result = await api.post<{ added: number; sources: { name: string; success: boolean }[] }>('/news/refresh');
      setStatus(`${result.added}개 새 기사 · ${result.sources.map(s => `${s.name}: ${s.success ? '수집 완료' : '수집 실패'}`).join(' / ')}`);
      setVersion(v => v + 1);
    } catch (e) { setError(errorMessage(e)); }
    finally { setRefreshing(false); }
  }
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-2xl font-semibold">매일 모아 보는 분야별 뉴스</h2><p className="mt-1 text-sm text-muted">IT · 경제 · 금융 · 부동산 · 국제 · 정치 · 사회</p></div>
      <Button onClick={refresh} loading={refreshing}><RefreshCw className="size-4" />뉴스 수집</Button>
    </header>
    {schedule && <Card title={schedule.enabled ? '매일 오전 7시 자동 수집 · 한국 시간' : '자동 수집 꺼짐'}><p className="text-sm text-muted">{schedule.notice}</p><p className="mt-2 text-xs text-muted">마지막 자동 수집 시도: {schedule.lastAttemptAt ? new Date(schedule.lastAttemptAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '아직 없음'} · 수집 완료일: {schedule.completedDay ?? '아직 없음'}</p></Card>}
    <div className="flex flex-wrap gap-2" aria-label="분야 선택">{[['', '전체'], ...Object.entries(categories).filter(([key]) => !['AI', 'SECURITY', 'DEV', 'TECH'].includes(key))].map(([key, label]) => <Button key={key} variant={category === key ? 'primary' : 'secondary'} aria-pressed={category === key} disabled={analyzing} onClick={() => { setCategory(key); setAnalysis(undefined); }}>{label}</Button>)}</div>
    {status && <p role="status" className="text-sm text-muted">{status} · 수집 간격 5분</p>}
    {error && <ErrorState message={error} onRetry={() => setVersion(v => v + 1)} />}
    {briefing && <Card title={`${category ? categories[category] : '전체'} 오늘의 브리핑 · ${briefing.date} (한국 시간)`} icon={Newspaper}>
      <p className="mb-3 text-xs text-muted">{briefing.notice}</p>
      <Button variant="secondary" className="mb-4" loading={analyzing} disabled={refreshing || !briefing.articles.length} onClick={analyze}>AI 브리핑 생성</Button>
      {analysis && <div className="mb-4 rounded-xl bg-surface-2 p-4 text-sm"><p className="mb-2 text-xs text-muted">{analysis.notice || analysis.message}</p>{analysis.summary?.map((line, i) => <p key={i} className="mb-2">{line}</p>)}{analysis.articles?.map(row => { const article = briefing.articles.find(a => a.id === row.id); return article && <div key={row.id} className="mt-4"><a className="font-medium text-accent" href={article.url} target="_blank" rel="noopener noreferrer">{article.title} ↗</a><p className="mt-1">중요성(추정): {row.importance}</p><p className="mt-1">예상 영향(추정): {row.impact}</p></div>; })}</div>}
      {briefing.articles.length ? <ol className="space-y-3">{briefing.articles.map((a, i) => <li key={a.id} className="text-sm"><a href={a.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{i + 1}. {briefing.lines[i]} <ExternalLink className="inline size-3" /></a></li>)}</ol> : <p className="text-sm text-muted">오늘 발행된 기사가 없습니다. 뉴스를 수집해 주세요.</p>}
    </Card>}
    <div className="flex flex-col gap-3 @xl:flex-row"><Input aria-label="뉴스 검색" placeholder="제목이나 내용 검색…" value={q} onChange={e => setQ(e.target.value)} maxLength={200} /><Select disabled={analyzing} aria-label="뉴스 카테고리" className="@xl:max-w-40" value={category} onChange={e => { setCategory(e.target.value); setAnalysis(undefined); }}><option value="">전체 카테고리</option>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
    {loading ? <Spinner /> : <><p className="text-xs text-muted">검색 결과 {total}개 · 최신 100개 표시 · 분야별 RSS 기준 분류, IT 세부 분야는 키워드 기준</p>
      {!articles.length ? <EmptyState icon={Newspaper} title="표시할 뉴스가 없습니다" description="뉴스를 수집하거나 검색 조건을 변경해 주세요." /> : <div className="grid gap-4 @2xl:grid-cols-2">{articles.map(a => <Card key={a.id}>
        <div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs text-muted">{a.source}</span><Badge className="bg-accent/10 text-accent">{categories[a.category]}</Badge></div>
        <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-semibold leading-relaxed hover:text-accent">{a.title} <ExternalLink className="inline size-3.5" /></a>
        <ArticleExcerpt article={analysis?.sourceArticles?.find(source => source.id === a.id) ?? a} />
        <p className="mt-4 text-xs text-muted">{a.publishedAt ? new Date(a.publishedAt).toLocaleString('ko-KR') : '발행일 미상'}</p>
      </Card>)}</div>}</>}
  </div>;
}

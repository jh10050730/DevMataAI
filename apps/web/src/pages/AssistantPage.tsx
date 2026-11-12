import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Bot, Search, Sun } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { onDataChanged } from '../lib/dataEvents';
import { briefingRequest, dayPart } from '../lib/date';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Spinner } from '../components/ui';
import NewsDigestCard from '../components/NewsDigestCard';
import AssistantChat from '../components/AssistantChat';
import { useAssistantChat } from '../context/AssistantChatContext';

type Result = { id: string; type: string; title: string; excerpt: string; href: string };
type Briefing = { date: string; limitations: string; counts: { activeTasks: number; notes: number; projects: number }; priorities: string[]; tasks: { id: string; title: string; priority: string }[]; overdue: { id: string; title: string }[]; dueToday: { id: string; title: string }[]; events: { id: string; title: string; startAt: string }[]; reviews: { id: string; title: string }[]; projects: { id: string; name: string; progress: { rate: number }; items: { status: string }[] }[]; news: { id: string; title: string; source: string; url: string }[] };
const labels: Record<string, string> = { task: '할 일', event: '일정', note: '학습', project: '프로젝트', projectItem: '프로젝트 작업', news: '뉴스' };
function ResultLink({ href, children }: { href: string; children: React.ReactNode }) { return href.startsWith('/') ? <Link to={href} className="text-accent hover:underline">{children}</Link> : <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{children} ↗</a>; }
export default function AssistantPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(q);
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [briefing, setBriefing] = useState<Briefing>();
  const [error, setError] = useState('');
  const { busy, send } = useAssistantChat();
  async function loadBriefing() { setBriefing(await api.get<Briefing>('/assistant/briefing')); }
  useEffect(() => { loadBriefing().catch(e => setError(errorMessage(e))); }, []);
  // AI 제안을 적용하면 브리핑 숫자도 바로 맞춘다
  useEffect(() => onDataChanged(() => { loadBriefing().catch(() => undefined); }), []);
  useEffect(() => {
    setSearchInput(q); setResults([]);
    if (!q.trim()) { setSearching(false); return; }
    let active = true; setSearching(true);
    api.get<{ results: Result[] }>(`/assistant/search?q=${encodeURIComponent(q)}`).then(data => { if (active) setResults(data.results); }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setSearching(false); });
    return () => { active = false; };
  }, [q]);
  return <div className="space-y-6">
    <header><h2 className="text-2xl font-semibold">나의 AI 워크스페이스</h2><p className="mt-1 text-sm text-muted">오늘의 우선순위, 통합 검색과 분야별 뉴스 요약</p></header>
    {error && <ErrorState message={error} />}
    <Card title="통합 검색" icon={Search}>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setParams(searchInput.trim() ? { q: searchInput.trim() } : {}); }}><Input required maxLength={100} aria-label="통합 검색" placeholder="일정·할 일·학습·프로젝트·뉴스 검색" value={searchInput} onChange={e => setSearchInput(e.target.value)} /><Button type="submit">검색</Button></form>
      {searching ? <Spinner /> : q && <><p className="my-3 text-xs text-muted">종류별 최신 최대 20개 · {results.length}개 표시</p>{!results.length ? <EmptyState title="검색 결과가 없습니다" /> : <div className="max-h-96 space-y-3 overflow-y-auto">{results.map(r => <div key={`${r.type}-${r.id}`}><Badge className="mr-2 bg-surface-2">{labels[r.type]}</Badge><ResultLink href={r.href}>{r.title}</ResultLink><p className="mt-1 line-clamp-2 text-xs text-muted">{r.excerpt}</p></div>)}</div>}</>}
    </Card>
    {!briefing ? <Spinner /> : <Card title={`${dayPart()} 브리핑 · ${briefing.date} 한국 시간`} icon={Sun} action={<Button variant="secondary" disabled={busy} onClick={() => loadBriefing().catch(e => setError(errorMessage(e)))}>새로고침</Button>}>
      <div className="grid gap-3 @xl:grid-cols-4">{[['미완료 할 일', briefing.counts.activeTasks], ['지난 마감', briefing.overdue.length], ['오늘 일정', briefing.events.length], ['복습 필요', briefing.reviews.length]].map(([label, n]) => <div key={label} className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-2xl font-semibold">{n}</p></div>)}</div>
      <div className="mt-4 grid gap-5 @2xl:grid-cols-2"><div><h3 className="mb-2 text-sm font-semibold">오늘의 우선순위</h3>{briefing.priorities.length ? briefing.priorities.map((p, i) => <p key={i} className="mb-1 text-sm">{i + 1}. {p}</p>) : <p className="text-sm text-muted">등록된 마감·복습 우선순위가 없습니다.</p>}<h3 className="mb-2 mt-4 text-sm font-semibold">오늘 일정</h3>{briefing.events.map(e => <p key={e.id} className="text-sm"><ResultLink href="/calendar">{new Date(e.startAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })} · {e.title}</ResultLink></p>)}</div><div><h3 className="mb-2 text-sm font-semibold">프로젝트 현황</h3>{briefing.projects.map(p => <p key={p.id} className="mb-1 text-sm"><ResultLink href="/projects">{p.name} · {p.progress.rate}%</ResultLink> · 미완료 {p.items.filter(i => i.status !== 'DONE').length}개</p>)}<h3 className="mb-2 mt-4 text-sm font-semibold">오늘의 뉴스</h3>{briefing.news.slice(0, 5).map(n => <p key={n.id} className="mb-1 text-sm"><ResultLink href={n.url}>{n.title}</ResultLink><span className="ml-1 text-xs text-muted">{n.source}</span></p>)}</div></div>
      <p className="mt-4 text-xs text-muted">{briefing.limitations}</p><Button className="mt-3" disabled={busy} onClick={() => void send(briefingRequest())}>AI에게 오늘 브리핑 요청</Button>
    </Card>}
    <NewsDigestCard />
    <Card title="개인 비서 채팅" icon={Bot}>
      <AssistantChat />
    </Card>
  </div>;
}

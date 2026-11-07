import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Bot, Search, Sun } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Select, Spinner, Textarea } from '../components/ui';
import Markdown from '../components/Markdown';

type Action = { id: string; kind: string; targetTitle: string; payload: string; expiresAt: string; state?: string };
type Message = { role: 'user' | 'assistant'; content: string; demo?: boolean; actions?: Action[] };
type Result = { id: string; type: string; title: string; excerpt: string; href: string };
type Briefing = { date: string; limitations: string; counts: { activeTasks: number; notes: number; projects: number }; priorities: string[]; tasks: { id: string; title: string; priority: string }[]; overdue: { id: string; title: string }[]; dueToday: { id: string; title: string }[]; events: { id: string; title: string; startAt: string }[]; reviews: { id: string; title: string }[]; projects: { id: string; name: string; progress: { rate: number }; items: { status: string }[] }[]; news: { id: string; title: string; source: string; url: string }[] };
type Recommendations = { keywords: string[]; reason: string; notes: { id: string; title: string }[]; news: { id: string; title: string; source: string; url: string }[] };
const labels: Record<string, string> = { task: '할 일', event: '일정', note: '학습', project: '프로젝트', projectItem: '프로젝트 작업', news: '뉴스' };
const actionLabels: Record<string, string> = { task_complete: '할 일 완료', task_rename: '할 일 제목 변경', task_delete: '할 일 삭제', event_delete: '일정 삭제', note_delete: '학습 노트 삭제', project_delete: '프로젝트와 하위 작업·보고서 삭제' };
function ResultLink({ href, children }: { href: string; children: React.ReactNode }) { return href.startsWith('/') ? <Link to={href} className="text-blue-500 hover:underline">{children}</Link> : <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{children} ↗</a>; }
export default function AssistantPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(q);
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [briefing, setBriefing] = useState<Briefing>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [projectId, setProjectId] = useState('');
  const [recommendations, setRecommendations] = useState<Recommendations>();
  const [recommending, setRecommending] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  async function loadBriefing() { setBriefing(await api.get<Briefing>('/assistant/briefing')); }
  useEffect(() => { loadBriefing().catch(e => setError(errorMessage(e))); }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages]);
  useEffect(() => {
    setSearchInput(q); setResults([]);
    if (!q.trim()) { setSearching(false); return; }
    let active = true; setSearching(true);
    api.get<{ results: Result[] }>(`/assistant/search?q=${encodeURIComponent(q)}`).then(data => { if (active) setResults(data.results); }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setSearching(false); });
    return () => { active = false; };
  }, [q]);
  useEffect(() => {
    setRecommendations(undefined); if (!projectId) { setRecommending(false); return; }
    let active = true; setRecommending(true);
    api.get<Recommendations>(`/assistant/recommendations/${projectId}`).then(data => { if (active) setRecommendations(data); }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setRecommending(false); });
    return () => { active = false; };
  }, [projectId]);
  async function send(e?: FormEvent, text = input) {
    e?.preventDefault(); if (!text.trim() || busy) return;
    setBusy(true); setError('');
    const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
    setMessages(rows => [...rows, { role: 'user', content: text }]); setInput('');
    try {
      const result = await api.post<{ answer: string; demo: boolean; actions: Action[] }>('/assistant/chat', { message: text, history });
      setMessages(rows => [...rows, { role: 'assistant', content: result.answer, demo: result.demo, actions: result.actions }]);
    } catch (e) { setError(errorMessage(e)); setInput(text); }
    finally { setBusy(false); }
  }
  async function resolve(action: Action, confirm: boolean) {
    setBusy(true); setError('');
    try {
      await api.post(`/assistant/actions/${action.id}/${confirm ? 'confirm' : 'cancel'}`);
      setMessages(rows => rows.map(m => ({ ...m, actions: m.actions?.map(a => a.id === action.id ? { ...a, state: confirm ? '적용 완료' : '취소됨' } : a) })));
      await loadBriefing();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <header><h2 className="text-2xl font-semibold">나의 AI 워크스페이스</h2><p className="mt-1 text-sm text-muted">오늘의 우선순위, 저장된 자료 검색, 프로젝트와 연결되는 학습·뉴스</p></header>
    {error && <ErrorState message={error} />}
    <Card title="통합 검색" icon={Search}>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setParams(searchInput.trim() ? { q: searchInput.trim() } : {}); }}><Input required maxLength={100} aria-label="통합 검색" placeholder="일정·할 일·학습·프로젝트·뉴스 검색" value={searchInput} onChange={e => setSearchInput(e.target.value)} /><Button type="submit">검색</Button></form>
      {searching ? <Spinner /> : q && <><p className="my-3 text-xs text-muted">종류별 최신 최대 20개 · {results.length}개 표시</p>{!results.length ? <EmptyState title="검색 결과가 없습니다" /> : <div className="max-h-96 space-y-3 overflow-y-auto">{results.map(r => <div key={`${r.type}-${r.id}`}><Badge className="mr-2 bg-surface-2">{labels[r.type]}</Badge><ResultLink href={r.href}>{r.title}</ResultLink><p className="mt-1 line-clamp-2 text-xs text-muted">{r.excerpt}</p></div>)}</div>}</>}
    </Card>
    {!briefing ? <Spinner /> : <Card title={`아침 브리핑 · ${briefing.date} 한국 시간`} icon={Sun} action={<Button variant="secondary" disabled={busy} onClick={() => loadBriefing().catch(e => setError(errorMessage(e)))}>새로고침</Button>}>
      <div className="grid gap-3 sm:grid-cols-4">{[['미완료 할 일', briefing.counts.activeTasks], ['지난 마감', briefing.overdue.length], ['오늘 일정', briefing.events.length], ['복습 필요', briefing.reviews.length]].map(([label, n]) => <div key={label} className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-2xl font-semibold">{n}</p></div>)}</div>
      <div className="mt-4 grid gap-5 md:grid-cols-2"><div><h3 className="mb-2 text-sm font-semibold">오늘의 우선순위</h3>{briefing.priorities.length ? briefing.priorities.map((p, i) => <p key={i} className="mb-1 text-sm">{i + 1}. {p}</p>) : <p className="text-sm text-muted">등록된 마감·복습 우선순위가 없습니다.</p>}<h3 className="mb-2 mt-4 text-sm font-semibold">오늘 일정</h3>{briefing.events.map(e => <p key={e.id} className="text-sm"><ResultLink href="/calendar">{new Date(e.startAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })} · {e.title}</ResultLink></p>)}</div><div><h3 className="mb-2 text-sm font-semibold">프로젝트 현황</h3>{briefing.projects.map(p => <p key={p.id} className="mb-1 text-sm"><ResultLink href="/projects">{p.name} · {p.progress.rate}%</ResultLink> · 미완료 {p.items.filter(i => i.status !== 'DONE').length}개</p>)}<h3 className="mb-2 mt-4 text-sm font-semibold">오늘의 뉴스</h3>{briefing.news.slice(0, 5).map(n => <p key={n.id} className="mb-1 text-sm"><ResultLink href={n.url}>{n.title}</ResultLink><span className="ml-1 text-xs text-muted">{n.source}</span></p>)}</div></div>
      <p className="mt-4 text-xs text-muted">{briefing.limitations}</p><Button className="mt-3" disabled={busy} onClick={() => void send(undefined, '오늘의 아침 브리핑을 해줘. 일정·할 일·복습·프로젝트·뉴스를 근거로 오늘 우선순위를 제안해줘.')}>AI에게 오늘 브리핑 요청</Button>
    </Card>}
    <Card title="프로젝트와 연결되는 자료"><Select aria-label="추천 기준 프로젝트" value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">프로젝트 선택</option>{briefing?.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>{recommending ? <Spinner /> : recommendations && <div className="mt-3 space-y-3"><p className="text-xs text-muted">{recommendations.reason} · {recommendations.keywords.join(', ')}</p>{recommendations.notes.map(n => <p key={n.id}><Badge className="mr-2 bg-surface-2">학습</Badge><ResultLink href="/study">{n.title}</ResultLink></p>)}{recommendations.news.map(n => <p key={n.id}><Badge className="mr-2 bg-surface-2">뉴스</Badge><ResultLink href={n.url}>{n.title}</ResultLink></p>)}{!recommendations.notes.length && !recommendations.news.length && <EmptyState title="일치하는 자료가 아직 없습니다" description="프로젝트 목표에 기술명을 추가하거나 관련 노트·뉴스를 저장해 보세요." />}</div>}</Card>
    <Card title="개인 비서 채팅" icon={Bot}>
      <p className="mb-4 text-xs text-muted">이 화면의 대화는 새로고침하면 초기화됩니다. AI는 저장된 데이터 중 제한된 범위를 참고하며, 변경 제안은 확인 전 실행되지 않습니다.</p>
      <div className="max-h-[36rem] space-y-4 overflow-y-auto">{!messages.length && <EmptyState icon={Bot} title="오늘 무엇을 먼저 할까요?" description="일정이나 학습, 프로젝트에 관해 질문해 보세요." />}{messages.map((m, i) => <div key={i} className={`rounded-xl p-4 ${m.role === 'user' ? 'ml-6 bg-blue-500/10' : 'mr-3 bg-surface-2'}`}><p className="mb-2 text-xs font-medium text-muted">{m.role === 'user' ? '나' : m.demo ? '비서 · DEMO (실제 AI 분석 아님)' : 'AI 비서'}</p><Markdown source={m.content} />{m.actions?.map(a => <div key={a.id} className="mt-3 rounded-lg border border-amber-500/50 p-3"><p className="text-sm font-medium">변경 제안: {actionLabels[a.kind]}</p><p className="mt-1 text-sm">대상: {a.targetTitle}</p>{a.kind === 'task_rename' && <p className="text-sm">새 제목: {JSON.parse(a.payload).title}</p>}<p className="my-2 text-xs text-muted">{a.state || `확인 전에는 변경되지 않습니다. ${new Date(a.expiresAt).toLocaleTimeString('ko-KR')}까지 유효합니다.`}</p>{!a.state && <div className="flex gap-2"><Button disabled={busy || Date.now() > new Date(a.expiresAt).getTime()} variant={a.kind.endsWith('delete') ? 'danger' : 'primary'} onClick={() => void resolve(a, true)}>확인하고 적용</Button><Button disabled={busy} variant="secondary" onClick={() => void resolve(a, false)}>취소</Button></div>}</div>)}</div>)}<div ref={chatEnd} /></div>
      {busy && <Spinner />}<form className="mt-4 flex items-end gap-2" onSubmit={e => void send(e)}><Textarea required aria-label="비서에게 질문" maxLength={2000} placeholder="오늘 할 일을 정리해줘…" value={input} onChange={e => setInput(e.target.value)} /><Button disabled={busy || !input.trim()} type="submit">보내기</Button></form>
    </Card>
  </div>;
}

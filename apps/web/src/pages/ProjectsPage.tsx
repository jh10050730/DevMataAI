import { useEffect, useState, type FormEvent } from 'react';
import { FolderGit2, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, ProgressBar, Select, Spinner, Textarea } from '../components/ui';
import Markdown from '../components/Markdown';
import ProjectFilesCard, { type FilesProject } from '../components/ProjectFilesCard';

type Item = { id: string; title: string; kind: string; status: string; notes: string };
type Project = FilesProject & { name: string; goal: string; description: string; status: string; items: Item[]; progress: { total: number; done: number; rate: number } };
type Report = { id: string; content: string; demo: boolean; provider: string; createdAt: string };
type Activity = { connected: boolean; message: string; sections: { kind: string; ok: boolean; message?: string; truncated: boolean; items: { id: string; title: string; url: string; state?: string; date?: string }[] }[] };
const statuses: Record<string, string> = { TODO: '예정', IN_PROGRESS: '진행 중', BLOCKED: '문제 있음', DONE: '완료' };
const emptyForm = { name: '', goal: '', description: '', repository: '', localPath: '', status: 'ACTIVE' };
export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<'new' | 'edit' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('TASK');
  const [notes, setNotes] = useState('');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [activity, setActivity] = useState<Activity>();
  const [reports, setReports] = useState<Report[]>([]);
  const project = projects.find(p => p.id === selected);
  async function load() {
    const rows = await api.get<Project[]>('/projects'); setProjects(rows);
    setSelected(current => rows.some(p => p.id === current) ? current : rows[0]?.id ?? '');
  }
  useEffect(() => { load().catch(e => setError(errorMessage(e))).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    setActivity(undefined); setReports([]);
    if (!selected) return;
    let active = true;
    api.get<Report[]>(`/projects/${selected}/reports`).then(rows => { if (active) setReports(rows); }).catch(e => { if (active) setError(errorMessage(e)); });
    return () => { active = false; };
  }, [selected]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  function editProject() {
    if (!project) return;
    setForm({ name: project.name, goal: project.goal, description: project.description, repository: project.repository, localPath: project.localPath, status: project.status }); setEditor('edit');
  }
  async function saveProject(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      if (editor === 'edit') await api.patch(`/projects/${selected}`, form);
      else { const { status: _status, ...values } = form; const created = await api.post<Project>('/projects', values); setSelected(created.id); }
      await load(); setEditor(null); setActivity(undefined);
    });
  }
  async function addItem(e: FormEvent) {
    e.preventDefault(); await run(async () => { await api.post(`/projects/${selected}/items`, { title, kind, notes }); setTitle(''); setNotes(''); await load(); });
  }
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">프로젝트 관리</h2><p className="mt-1 text-sm text-muted">목표에서 작업, GitHub 활동과 주간 보고서까지</p></div><Button disabled={busy} onClick={() => { setForm(emptyForm); setEditor('new'); }}><Plus className="size-4" />프로젝트 만들기</Button></header>
    {error && <ErrorState message={error} />}
    {loading ? <Spinner /> : !projects.length ? <EmptyState icon={FolderGit2} title="첫 프로젝트를 만들어 보세요" description="목표와 기능을 등록하고 작업 완료율을 확인하세요." /> : <>
      <div className="flex flex-wrap gap-2">{projects.map(p => <Button key={p.id} disabled={busy} variant={selected === p.id ? 'primary' : 'secondary'} onClick={() => setSelected(p.id)}>{p.name} · {p.progress.rate}%</Button>)}</div>
      {project && <>
        <Card title={project.name} action={<div className="flex gap-2"><Button disabled={busy} variant="secondary" onClick={editProject}>수정</Button><Button disabled={busy} variant="danger" aria-label="프로젝트 삭제" onClick={() => { if (window.confirm('프로젝트와 모든 작업·보고서를 삭제할까요?')) void run(async () => { await api.delete(`/projects/${selected}`); await load(); }); }}><Trash2 className="size-4" /></Button></div>}>
          <Badge className="mb-3 bg-blue-500/10 text-blue-500">{{ ACTIVE: '진행 중', PAUSED: '일시 중지', COMPLETED: '완료' }[project.status]}</Badge>
          <p className="mb-2 whitespace-pre-wrap text-sm">목표: {project.goal || '목표를 작성해 주세요.'}</p><p className="mb-4 whitespace-pre-wrap text-sm text-muted">{project.description}</p>
          <ProgressBar value={project.progress.rate} /><p className="mt-2 text-xs text-muted">등록된 기능·작업 {project.progress.total}개 중 {project.progress.done}개 완료 · {project.progress.rate}%{project.aiProgress !== null && <> · <span className="text-violet-500">AI 추정 {project.aiProgress}%</span></>}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {project.repository && <a className="text-blue-500" href={`https://github.com/${project.repository}`} target="_blank" rel="noopener noreferrer">{project.repository} ↗</a>}
            {project.localPath && <span className="break-all text-muted">PC 폴더: {project.localPath}</span>}
          </div>
        </Card>
        <ProjectFilesCard project={project} onAnalyzed={load} />
        <Card title="기능과 작업">
          <form onSubmit={addItem} className="mb-4 space-y-2"><div className="flex gap-2"><Select aria-label="항목 종류" className="max-w-24" value={kind} onChange={e => setKind(e.target.value)}><option value="TASK">작업</option><option value="FEATURE">기능</option></Select><Input required maxLength={200} aria-label="작업 제목" placeholder="구현할 기능 또는 작업" value={title} onChange={e => setTitle(e.target.value)} /><Button type="submit" disabled={busy}>추가</Button></div><Textarea aria-label="작업 메모" maxLength={5000} placeholder="작업 내용이나 예상 문제 (선택)" value={notes} onChange={e => setNotes(e.target.value)} /></form>
          {!project.items.length && <EmptyState title="등록된 작업이 없습니다" />}
          <div className="space-y-3">{project.items.map(item => <div key={item.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center gap-2"><Badge className="bg-surface-2">{item.kind === 'FEATURE' ? '기능' : '작업'}</Badge><span className="min-w-0 flex-1 text-sm">{item.title}</span><Select className="max-w-32" aria-label={`${item.title} 상태`} disabled={busy} value={item.status} onChange={e => void run(async () => { await api.patch(`/projects/${selected}/items/${item.id}`, { status: e.target.value }); await load(); })}>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select><Button disabled={busy} variant="ghost" onClick={() => setEditingItem(item)}>편집</Button><Button disabled={busy} variant="ghost" aria-label={`${item.title} 삭제`} onClick={() => { if (window.confirm('이 항목을 삭제할까요?')) void run(async () => { await api.delete(`/projects/${selected}/items/${item.id}`); await load(); }); }}><Trash2 className="size-4" /></Button></div>{item.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-muted">{item.notes}</p>}</div>)}</div>
        </Card>
        <Card title="GitHub · 최근 7일" action={<Button variant="secondary" disabled={busy || !project.repository} onClick={() => void run(async () => setActivity(await api.get<Activity>(`/projects/${selected}/github`)))}>활동 조회</Button>}>
          <p className="text-xs text-muted">공개 저장소는 토큰 없이 조회할 수 있습니다. 비공개 저장소는 서버의 GITHUB_TOKEN 권한이 필요합니다.</p>
          {activity ? <><p className="my-3 text-xs text-muted">{activity.message}</p><div className="grid gap-4 lg:grid-cols-3">{activity.sections.map(section => <div key={section.kind}><h3 className="mb-2 text-sm font-semibold">{{ commits: '커밋', issues: '이슈', pulls: 'PR' }[section.kind]} ({section.items.length})</h3>{!section.ok && <p className="text-xs text-red-500">{section.message}</p>}{section.truncated && <p className="text-xs text-amber-500">조회 상한 100개에 도달해 일부 활동이 생략될 수 있습니다.</p>}<ul className="max-h-72 space-y-2 overflow-y-auto">{section.items.map(item => <li key={item.id} className="text-xs"><a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500">{item.title.split('\n')[0]} ↗</a><p className="text-muted">{item.state} {item.date && new Date(item.date).toLocaleDateString('ko-KR')}</p></li>)}</ul>{section.ok && !section.items.length && <p className="text-xs text-muted">이 기간에 조회된 활동이 없습니다.</p>}</div>)}</div></> : <p className="mt-3 text-sm text-muted">{project.repository ? '활동 조회 버튼으로 저장소 소식을 가져오세요.' : '프로젝트 수정에서 owner/repository를 등록하세요.'}</p>}
        </Card>
        <Card title="AI 주간 보고서" action={<Button loading={busy} onClick={() => void run(async () => { const report = await api.post<Report>(`/projects/${selected}/reports`); setReports(rows => [report, ...rows].slice(0, 20)); })}>보고서 생성</Button>}>
          <p className="mb-4 text-xs text-muted">최근 7일 완료한 작업, 현재 진행·문제, GitHub 활동을 기반으로 다음 작업을 제안합니다. 보고서는 생성 당시 기록으로 저장됩니다.</p>
          {!reports.length ? <EmptyState title="저장된 보고서가 없습니다" /> : reports.map((report, i) => <details key={report.id} open={i === 0} className="mb-3 rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm">{new Date(report.createdAt).toLocaleString('ko-KR')} · {report.demo ? 'DEMO · 실제 AI 분석 아님' : report.provider}</summary><Markdown className="mt-4" source={report.content} /></details>)}
        </Card>
      </>}
    </>}
    <Modal open={editor !== null} onClose={() => { if (!busy) setEditor(null); }} title={editor === 'new' ? '새 프로젝트' : '프로젝트 수정'}><form onSubmit={saveProject} className="space-y-4"><Field label="프로젝트 이름"><Input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field><Field label="목표"><Textarea maxLength={2000} value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })} /></Field><Field label="설명"><Textarea maxLength={10000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field><Field label="GitHub 저장소" hint="예: owner/repository"><Input maxLength={200} pattern="[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+" value={form.repository} onChange={e => setForm({ ...form, repository: e.target.value })} /></Field><Field label="PC 폴더 경로 (선택)" hint="예: C:\Users\me\projects\my-app · AI 진행률 분석에서 읽기 전용으로 사용"><Input maxLength={500} value={form.localPath} onChange={e => setForm({ ...form, localPath: e.target.value })} /></Field>{editor === 'edit' && <Field label="상태"><Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="ACTIVE">진행 중</option><option value="PAUSED">일시 중지</option><option value="COMPLETED">완료</option></Select></Field>}<Button type="submit" loading={busy}>저장</Button></form></Modal>
    <Modal open={!!editingItem} onClose={() => { if (!busy) setEditingItem(null); }} title="작업 편집">{editingItem && <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => { await api.patch(`/projects/${selected}/items/${editingItem.id}`, { title: editingItem.title, notes: editingItem.notes }); await load(); setEditingItem(null); }); }}><Field label="제목"><Input required maxLength={200} value={editingItem.title} onChange={e => setEditingItem({ ...editingItem, title: e.target.value })} /></Field><Field label="내용·문제 메모"><Textarea maxLength={5000} value={editingItem.notes} onChange={e => setEditingItem({ ...editingItem, notes: e.target.value })} /></Field><Button loading={busy} type="submit">저장</Button></form>}</Modal>
  </div>;
}

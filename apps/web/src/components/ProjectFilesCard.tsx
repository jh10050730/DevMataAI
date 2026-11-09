import { FileText, FolderOpen, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { Badge, Button, Card, EmptyState, Input, Modal, ProgressBar, Spinner } from './ui';

type Source = 'local' | 'github';
type Detail = { summary: string; confidence: 'low' | 'medium' | 'high'; done: string[]; remaining: string[]; sources: { source: Source; root: string; fileCount: number; truncated: boolean; read: string[]; error?: string }[]; model?: string };
export type FilesProject = { id: string; localPath: string; repository: string; aiProgress: number | null; aiProgressDetail: string | null; aiProgressAt: string | null };
type Listing = { files: { path: string; size: number }[]; truncated: boolean; branch?: string };

const CONFIDENCE = { low: '낮음', medium: '보통', high: '높음' };
const SOURCE_LABEL: Record<Source, string> = { local: 'PC 폴더', github: 'GitHub' };
const parse = (s: string | null): Detail | null => { try { return s ? JSON.parse(s) as Detail : null; } catch { return null; } };

/** 프로젝트 파일(읽기 전용) 보기와 AI 진행률 분석 */
export default function ProjectFilesCard({ project, onAnalyzed }: { project: FilesProject; onAnalyzed: () => Promise<void> }) {
  const sources = useMemo(() => (['local', 'github'] as Source[]).filter(s => (s === 'local' ? project.localPath : project.repository)), [project.localPath, project.repository]);
  const [source, setSource] = useState<Source | undefined>(sources[0]);
  const [listing, setListing] = useState<Listing>();
  const [filter, setFilter] = useState('');
  const [viewing, setViewing] = useState<{ path: string; content?: string; error?: string }>();
  const [busy, setBusy] = useState<'list' | 'analyze' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const detail = parse(project.aiProgressDetail);

  useEffect(() => { setSource(sources[0]); setListing(undefined); setMsg(undefined); setFilter(''); }, [project.id, sources]);

  const loadFiles = async (s: Source) => {
    setSource(s); setBusy('list'); setMsg(undefined);
    try { setListing(await api.get<Listing>(`/projects/${project.id}/files?source=${s}`)); }
    catch (e) { setListing(undefined); setMsg({ ok: false, text: errorMessage(e) }); }
    finally { setBusy(null); }
  };
  const open = async (path: string) => {
    setViewing({ path });
    try { setViewing({ path, content: (await api.get<{ content: string }>(`/projects/${project.id}/files/content?source=${source}&path=${encodeURIComponent(path)}`)).content }); }
    catch (e) { setViewing({ path, error: errorMessage(e) }); }
  };
  const analyze = async () => {
    setBusy('analyze'); setMsg(undefined);
    try {
      const r = await api.post<{ demo: boolean; message?: string; aiProgress?: number }>(`/projects/${project.id}/analyze`);
      setMsg(r.demo ? { ok: false, text: r.message ?? '데모 모드입니다.' } : { ok: true, text: `AI 추정 진행률 ${r.aiProgress}%로 저장했어요.` });
      await onAnalyzed();
    } catch (e) { setMsg({ ok: false, text: errorMessage(e) }); }
    finally { setBusy(null); }
  };
  const shown = listing?.files.filter(f => f.path.toLowerCase().includes(filter.toLowerCase())).slice(0, 300) ?? [];

  return (
    <Card title="프로젝트 파일 · AI 진행률" icon={FolderOpen} action={<Button loading={busy === 'analyze'} disabled={!!busy || !sources.length} onClick={() => void analyze()}><Sparkles className="size-4" />AI로 진행률 분석</Button>}>
      {!sources.length ? (
        <p className="text-sm text-muted">프로젝트 수정에서 <b>PC 폴더 경로</b>나 <b>GitHub 저장소</b>를 등록하면, AI가 파일을 읽고 목표 대비 진행률을 추정합니다. 파일은 읽기만 하고 바꾸지 않습니다.</p>
      ) : (
        <p className="text-xs text-muted">AI가 폴더 구조와 README·문서·설정 파일 일부를 읽고 목표 대비 진행률을 추정합니다 (파일은 읽기 전용, <code>.env</code>·키 파일·node_modules 제외). 추정치이므로 근거를 함께 확인하세요.{busy === 'analyze' && ' 분석에 1분 정도 걸릴 수 있어요.'}</p>
      )}
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-500' : 'text-red-500'}`}>{msg.text}</p>}

      {project.aiProgress !== null && detail && (
        <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-semibold">{project.aiProgress}%</span>
            <Badge className="bg-violet-500/15 text-violet-600 dark:text-violet-400">AI 추정</Badge>
            <Badge className="bg-surface-2">신뢰도 {CONFIDENCE[detail.confidence] ?? detail.confidence}</Badge>
            {project.aiProgressAt && <span className="text-xs text-muted">{new Date(project.aiProgressAt).toLocaleString('ko-KR')} 분석</span>}
          </div>
          <ProgressBar value={project.aiProgress} className="mt-2" />
          <p className="mt-3 text-sm">{detail.summary}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div><h4 className="mb-1 text-xs font-semibold text-emerald-500">구현된 것</h4><ul className="list-disc space-y-1 pl-4 text-xs">{detail.done.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
            <div><h4 className="mb-1 text-xs font-semibold text-amber-500">남은 것</h4><ul className="list-disc space-y-1 pl-4 text-xs">{detail.remaining.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
          </div>
          <p className="mt-3 text-[11px] text-muted">근거: {detail.sources.map(s => `${SOURCE_LABEL[s.source]} 파일 ${s.fileCount}개${s.truncated ? '(일부)' : ''} 중 ${s.read.length}개 내용 읽음${s.error ? ` · 오류: ${s.error}` : ''}`).join(' / ')}</p>
        </div>
      )}

      {!!sources.length && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {sources.map(s => <Button key={s} variant={listing && source === s ? 'primary' : 'secondary'} loading={busy === 'list' && source === s} disabled={!!busy} onClick={() => void loadFiles(s)}>{SOURCE_LABEL[s]} 파일 보기</Button>)}
            <span className="truncate text-xs text-muted">{source === 'local' ? project.localPath : project.repository}{listing?.branch && ` (${listing.branch})`}</span>
          </div>
          {busy === 'list' && <Spinner />}
          {listing && busy !== 'list' && (
            <div className="mt-3">
              <Input aria-label="파일 이름 필터" placeholder="파일 이름으로 찾기" value={filter} onChange={e => setFilter(e.target.value)} />
              <p className="my-2 text-xs text-muted">파일 {listing.files.length}개{listing.truncated && ' (많아서 일부만 표시)'} · 최대 300개 표시</p>
              {!shown.length ? <EmptyState title="표시할 파일이 없습니다" /> : (
                <ul className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-border p-2">
                  {shown.map(f => <li key={f.path}><button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-surface-2" onClick={() => void open(f.path)}><FileText className="size-3.5 shrink-0 text-muted" /><span className="min-w-0 flex-1 truncate">{f.path}</span><span className="text-muted">{f.size >= 1000 ? `${Math.round(f.size / 1000)}KB` : `${f.size}B`}</span></button></li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <Modal open={!!viewing} onClose={() => setViewing(undefined)} title={viewing?.path ?? ''}>
        {viewing && (viewing.error ? <p className="text-sm text-red-500">{viewing.error}</p> : viewing.content === undefined ? <Spinner /> : <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-2 p-3 text-xs">{viewing.content}</pre>)}
      </Modal>
    </Card>
  );
}

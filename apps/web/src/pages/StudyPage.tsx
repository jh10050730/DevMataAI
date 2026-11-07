import { BookOpen, Clock, Download, FileText, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import StudyNoteView, { NoteEditor } from '../components/StudyNoteView';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, ProgressBar, Select, Skeleton, Spinner, cn } from '../components/ui';
import { errorMessage } from '../lib/api';
import { fmtDate } from '../lib/date';
import { getIntegrationStatus, studyApi, type StudyNote } from '../lib/study';
import { useAsync } from '../lib/useAsync';

const SUBJECT_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

export default function StudyPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('note');
  const [subjectFilter, setSubjectFilter] = useState<string | null | undefined>(undefined); // undefined=전체, null=미분류
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const overview = useAsync(() => studyApi.overview(), []);
  const subjects = useAsync(() => studyApi.subjects(), []);
  const notes = useAsync(
    () => studyApi.notes({ q: query, subjectId: subjectFilter ?? undefined, tag, due: dueOnly }),
    [query, subjectFilter, tag, dueOnly],
  );
  const integrations = useAsync(() => getIntegrationStatus().catch(() => null), []);
  const notionReady = !!integrations.data?.notion.ok;

  const selected = useAsync<StudyNote | null>(() => (selectedId ? studyApi.note(selectedId) : Promise.resolve(null)), [selectedId]);

  // 검색은 입력이 멈춘 뒤 실행
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const select = (id: string | null) => {
    setCreating(false);
    setParams(id ? { note: id } : {});
  };

  const refreshAll = (updated?: StudyNote) => {
    if (updated) selected.setData(updated);
    else void selected.reload();
    void notes.reload();
    void overview.reload();
  };

  // 미분류 필터는 서버 API 에 없어서 화면에서 거름
  const visibleNotes = (notes.data ?? []).filter((n) => subjectFilter !== null || n.subjectId === null);
  const showDetail = creating || !!selectedId;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_320px_1fr]">
      {/* 과목 / 태그 */}
      <div className={cn('space-y-6', showDetail && 'hidden lg:block')}>
        <SubjectsPanel
          overview={overview}
          subjectFilter={subjectFilter}
          onFilter={setSubjectFilter}
          onChanged={() => {
            void overview.reload();
            void subjects.reload();
            void notes.reload();
          }}
        />
        {!!overview.data?.tags.length && (
          <Card title="태그" icon={Tag}>
            <div className="flex flex-wrap gap-1.5">
              {overview.data.tags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(tag === t ? '' : t)}
                  className={cn('rounded-md px-2 py-0.5 text-xs', tag === t ? 'bg-blue-600 text-white' : 'bg-surface-2 text-muted hover:text-fg')}
                >
                  #{t}
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* 노트 목록 */}
      <div className={cn('space-y-3', showDetail && 'hidden lg:block')}>
        <div className="flex gap-2">
          <Button onClick={() => { setParams({}); setCreating(true); }} className="flex-1">
            <Plus className="size-4" /> 새 노트
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)} title="Notion 페이지 가져오기">
            <Download className="size-4" /> Notion
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목·내용 검색" className="pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-muted">
            <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} className="accent-blue-600" />
            복습 필요만
          </label>
          {tag && (
            <button onClick={() => setTag('')} className="flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-blue-500">
              #{tag} <X className="size-3" />
            </button>
          )}
        </div>

        {notes.error ? (
          <ErrorState message={notes.error} onRetry={notes.reload} />
        ) : notes.loading && !notes.data ? (
          <Skeleton lines={5} />
        ) : visibleNotes.length === 0 ? (
          <Card>
            <EmptyState
              icon={FileText}
              title={query || tag || dueOnly ? '조건에 맞는 노트가 없어요' : '아직 학습 노트가 없어요'}
              description={query || tag || dueOnly ? undefined : '‘새 노트’로 작성하거나 Notion 페이지를 가져와보세요.'}
            />
          </Card>
        ) : (
          <ul className="space-y-2">
            {visibleNotes.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => select(n.id)}
                  className={cn(
                    'w-full rounded-xl border bg-surface p-3 text-left transition-colors',
                    n.id === selectedId ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-border hover:border-blue-500/40',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: n.subject?.color ?? '#64748b' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{n.title}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {n.subject?.name ?? '미분류'} · {fmtDate(n.updatedAt)}
                      </span>
                    </span>
                    {n.reviewDue && <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">복습</Badge>}
                  </div>
                  <ProgressBar value={n.progress} className="mt-2 h-1" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 노트 상세 / 작성 */}
      <div className={cn(!showDetail && 'hidden lg:block')}>
        {creating ? (
          <NoteEditor
            subjects={subjects.data ?? []}
            initial={null}
            onCancel={() => setCreating(false)}
            onSave={async (input) => {
              const created = await studyApi.create(input);
              setCreating(false);
              refreshAll();
              select(created.id);
            }}
          />
        ) : !selectedId ? (
          <Card className="py-10">
            <EmptyState icon={BookOpen} title="노트를 선택하세요" description="왼쪽 목록에서 노트를 고르면 내용, 복습 기록, AI 학습 도우미가 표시돼요." />
          </Card>
        ) : selected.error ? (
          <ErrorState message={selected.error} onRetry={selected.reload} />
        ) : !selected.data ? (
          <Spinner />
        ) : (
          <StudyNoteView
            note={selected.data}
            subjects={subjects.data ?? []}
            notionReady={notionReady}
            onBack={() => select(null)}
            onChanged={refreshAll}
            onDeleted={() => {
              select(null);
              refreshAll();
            }}
          />
        )}
      </div>

      <NotionImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        notionStatus={integrations.data?.notion}
        subjects={subjects.data ?? []}
        onImported={(id) => {
          refreshAll();
          select(id);
        }}
      />
    </div>
  );
}

function SubjectsPanel({
  overview,
  subjectFilter,
  onFilter,
  onChanged,
}: {
  overview: ReturnType<typeof useAsync<Awaited<ReturnType<typeof studyApi.overview>>>>;
  subjectFilter: string | null | undefined;
  onFilter: (v: string | null | undefined) => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = overview.data;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    try {
      await studyApi.createSubject(name.trim(), SUBJECT_COLORS[(data?.subjects.length ?? 0) % SUBJECT_COLORS.length]);
      setName('');
      setAdding(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await studyApi.deleteSubject(id);
      setConfirmId(null);
      if (subjectFilter === id) onFilter(undefined);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Card
      title="과목별 진행"
      icon={BookOpen}
      action={
        <button onClick={() => setAdding((a) => !a)} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="과목 추가">
          <Plus className="size-4" />
        </button>
      }
    >
      {data && (
        <div className="mb-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-surface-2 p-2">
            <p className="text-lg font-semibold">{data.total}</p>
            <p className="text-[11px] text-muted">노트</p>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-2">
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{data.due}</p>
            <p className="flex items-center justify-center gap-1 text-[11px] text-muted">
              <Clock className="size-3" /> 복습 필요
            </p>
          </div>
        </div>
      )}

      {adding && (
        <form onSubmit={add} className="mb-3 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="과목 이름" maxLength={80} autoFocus className="py-1.5" />
          <Button type="submit" className="px-3 py-1.5 text-xs">
            추가
          </Button>
        </form>
      )}
      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

      {overview.error ? (
        <ErrorState message={overview.error} onRetry={overview.reload} />
      ) : !data ? (
        <Skeleton lines={3} />
      ) : (
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => onFilter(undefined)}
              className={cn('w-full rounded-lg px-2 py-1.5 text-left text-sm', subjectFilter === undefined ? 'bg-blue-500/10 font-medium text-blue-600 dark:text-blue-400' : 'text-muted hover:bg-surface-2')}
            >
              전체 노트
            </button>
          </li>
          {data.subjects
            .filter((s) => s.id !== null || s.total > 0)
            .map((s) => (
              <li key={s.id ?? 'none'} className="group relative">
                <button
                  onClick={() => onFilter(s.id)}
                  className={cn('w-full rounded-lg px-2 py-1.5 text-left', subjectFilter === s.id ? 'bg-blue-500/10' : 'hover:bg-surface-2')}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <span className="size-2 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-[11px] text-muted">
                      {s.total}개{s.due > 0 && <span className="text-amber-500"> · 복습 {s.due}</span>}
                    </span>
                  </span>
                  <ProgressBar value={s.progress} className="mt-1.5 h-1" />
                </button>
                {s.id &&
                  (confirmId === s.id ? (
                    <span className="absolute right-1 top-1 flex gap-1 rounded-md bg-surface p-0.5 shadow">
                      <button onClick={() => remove(s.id!)} className="rounded px-1.5 text-[11px] text-red-500 hover:bg-red-500/10">
                        삭제
                      </button>
                      <button onClick={() => setConfirmId(null)} className="rounded px-1.5 text-[11px] text-muted">
                        취소
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmId(s.id)}
                      className="absolute right-1 top-1 hidden rounded p-1 text-muted hover:text-red-500 group-hover:block"
                      aria-label={`${s.name} 과목 삭제`}
                      title="과목 삭제 (노트는 미분류로 유지)"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  ))}
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}

function NotionImportModal({
  open,
  onClose,
  notionStatus,
  subjects,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  notionStatus?: { configured: boolean; ok: boolean; detail: string };
  subjects: { id: string; name: string }[];
  onImported: (noteId: string) => void;
}) {
  const [page, setPage] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPage('');
      setError(null);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await studyApi.importNotion(page.trim(), subjectId || undefined);
      onImported(r.noteId);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Notion 페이지 가져오기">
      {!notionStatus?.ok ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
            Notion이 연결되지 않았어요. {notionStatus?.detail}
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>notion.so/my-integrations 에서 Internal Integration을 만들고 토큰을 복사</li>
            <li>
              <code className="rounded bg-surface-2 px-1">apps/api/.env</code> 의 <code className="rounded bg-surface-2 px-1">NOTION_TOKEN</code> 에 붙여넣기
            </li>
            <li>가져올 Notion 페이지에서 ··· → 연결(Connections) → 만든 integration 추가</li>
            <li>API 서버 재시작</li>
          </ol>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Notion 페이지 링크" hint="이미 가져온 페이지를 다시 가져오면 새 노트를 만들지 않고 기존 노트를 갱신해요.">
            <Input value={page} onChange={(e) => setPage(e.target.value)} required placeholder="https://www.notion.so/…" autoFocus />
          </Field>
          <Field label="과목 (새 노트일 때)">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">미분류</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" loading={loading}>
              가져오기
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

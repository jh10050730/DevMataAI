import { ArrowLeft, BookCheck, Bot, Check, Copy, Eye, Loader2, Pencil, Send, Sparkles, Trash2, Upload } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage } from '../lib/api';
import { fmtDate } from '../lib/date';
import { AI_ACTIONS, RATING_LABEL, studyApi, type AiAction, type AiResult, type NoteInput, type Rating, type StudyNote, type StudySubject } from '../lib/study';
import Markdown from './Markdown';
import { Badge, Button, Card, Field, Input, Modal, ProgressBar, Select, Textarea, cn } from './ui';

const RATING_STYLE: Record<Rating, string> = {
  again: 'hover:border-red-500/60 hover:text-red-500',
  hard: 'hover:border-amber-500/60 hover:text-amber-500',
  good: 'hover:border-blue-500/60 hover:text-blue-500',
  easy: 'hover:border-emerald-500/60 hover:text-emerald-500',
};

/** 노트 편집 폼 (새 노트 / 수정 공용) */
export function NoteEditor({
  initial,
  subjects,
  onSave,
  onCancel,
}: {
  initial?: StudyNote | null;
  subjects: StudySubject[];
  onSave: (n: NoteInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title,
        content,
        subjectId: subjectId || null,
        tags: [...new Set(tags.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 20),
      });
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <Field label="제목">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="과목">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">미분류</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="태그 (쉼표로 구분)">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="네트워크, 시험범위" />
          </Field>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">내용 (Markdown)</span>
            <button type="button" onClick={() => setPreview((p) => !p)} className="flex items-center gap-1 text-xs text-blue-500">
              {preview ? <Pencil className="size-3" /> : <Eye className="size-3" />}
              {preview ? '편집' : '미리보기'}
            </button>
          </div>
          {preview ? (
            <div className="min-h-64 rounded-lg border border-border p-4">
              <Markdown source={content} />
            </div>
          ) : (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={50000}
              className="min-h-64 font-mono text-[13px]"
              placeholder={'# 제목\n\n- 핵심 내용\n- **굵게**, `코드`'}
            />
          )}
          <p className="text-right text-[11px] text-muted">{content.length.toLocaleString()} / 50,000</p>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" loading={saving}>
            저장
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** 노트 상세: 본문, 복습 기록, AI 학습 도우미, Notion 저장 */
export default function StudyNoteView({
  note,
  subjects,
  notionReady,
  onBack,
  onChanged,
  onDeleted,
}: {
  note: StudyNote;
  subjects: StudySubject[];
  notionReady: boolean;
  onBack: () => void;
  onChanged: (n?: StudyNote) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [progress, setProgress] = useState(note.progress);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notionDialog, setNotionDialog] = useState<null | 'create' | 'replace'>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // AI
  const [question, setQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState<AiAction | null>(null);
  const [aiResult, setAiResult] = useState<(AiResult & { seconds: number }) | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEditing(false);
    setProgress(note.progress);
    setAiResult(null);
    setAiError(null);
    setError(null);
    setNotice(null);
    setConfirmDelete(false);
    setQuestion('');
    // 다른 노트로 바뀔 때만 초기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const runAi = async (action: AiAction) => {
    if (action === 'ask' && !question.trim()) return setAiError('질문을 입력해주세요.');
    setAiLoading(action);
    setAiError(null);
    const started = Date.now();
    try {
      const q = action === 'ask' || action === 'explain' ? question.trim() || undefined : undefined;
      const r = await studyApi.ai(note.id, action, q);
      setAiResult({ ...r, seconds: Math.round((Date.now() - started) / 1000) });
    } catch (e) {
      setAiError(errorMessage(e));
    } finally {
      setAiLoading(null);
    }
  };

  const exportNotion = (replace: boolean) =>
    act('notion', async () => {
      setNotionDialog(null);
      try {
        const r = await studyApi.exportNotion(note.id, replace);
        setNotice(
          r.status === 'unchanged'
            ? '마지막 저장 이후 바뀐 내용이 없어 저장하지 않았어요.'
            : r.status === 'created'
              ? 'Notion에 새 페이지로 저장했어요.'
              : 'Notion 페이지를 최신 내용으로 덮어썼어요.',
        );
        onChanged();
      } catch (e) {
        // 연결된 페이지를 덮어쓰려면 별도 확인 필요
        if (e instanceof Error && 'status' in e && (e as { status: number }).status === 409) setNotionDialog('replace');
        else throw e;
      }
    });

  if (editing) {
    return (
      <NoteEditor
        initial={note}
        subjects={subjects}
        onCancel={() => setEditing(false)}
        onSave={async (n) => {
          const updated = await studyApi.update(note.id, n);
          setEditing(false);
          onChanged(updated);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex flex-wrap items-start gap-2">
          <button onClick={onBack} className="rounded-md p-1 text-muted hover:bg-surface-2 lg:hidden" aria-label="목록으로">
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{note.title}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge className="bg-surface-2 text-muted">
                <span className="mr-1 size-1.5 rounded-full" style={{ background: note.subject?.color ?? '#64748b' }} />
                {note.subject?.name ?? '미분류'}
              </Badge>
              {note.tags.map((t) => (
                <Badge key={t} className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  #{t}
                </Badge>
              ))}
              {note.notionPageId && <Badge className="bg-surface-2 text-muted">Notion 연결됨</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="secondary" onClick={() => setEditing(true)} className="px-2.5 py-1.5 text-xs">
              <Pencil className="size-3.5" /> 편집
            </Button>
            <Button
              variant="secondary"
              onClick={() => setNotionDialog(note.notionPageId ? 'replace' : 'create')}
              disabled={!notionReady}
              title={notionReady ? undefined : '설정 화면에서 Notion 연결 상태를 확인하세요'}
              loading={busy === 'notion'}
              className="px-2.5 py-1.5 text-xs"
            >
              <Upload className="size-3.5" /> Notion 저장
            </Button>
            {confirmDelete ? (
              <>
                <Button variant="danger" onClick={() => act('delete', async () => { await studyApi.remove(note.id); onDeleted(); })} loading={busy === 'delete'} className="px-2.5 py-1.5 text-xs">
                  삭제
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 text-xs">
                  취소
                </Button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="rounded-md p-1.5 text-muted hover:bg-red-500/10 hover:text-red-500" aria-label="노트 삭제">
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </div>
        {notice && <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">{notice}</p>}
        {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}
        <Markdown source={note.content} />
      </Card>

      <Card title="복습 기록" icon={BookCheck}>
        <div className="mb-4 grid grid-cols-3 gap-3 text-center text-xs">
          <div className="rounded-lg bg-surface-2 p-2.5">
            <p className="text-muted">마지막 학습</p>
            <p className="mt-1 font-medium">{note.lastStudiedAt ? fmtDate(note.lastStudiedAt) : '없음'}</p>
          </div>
          <div className={cn('rounded-lg p-2.5', note.reviewDue ? 'bg-amber-500/10' : 'bg-surface-2')}>
            <p className="text-muted">다음 복습</p>
            <p className={cn('mt-1 font-medium', note.reviewDue && 'text-amber-600 dark:text-amber-400')}>
              {note.reviewDue ? '지금 복습' : note.nextReviewAt ? fmtDate(note.nextReviewAt) : '–'}
            </p>
          </div>
          <div className="rounded-lg bg-surface-2 p-2.5">
            <p className="text-muted">복습 횟수</p>
            <p className="mt-1 font-medium">{note.reviewCount}회</p>
          </div>
        </div>
        <div className="mb-4 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted">학습 진도</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <input type="range" min={0} max={100} step={10} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-blue-600" aria-label="학습 진도" />
          <ProgressBar value={progress} />
        </div>
        <p className="mb-2 text-xs text-muted">오늘 학습했다면 얼마나 잘 기억났는지 선택하세요. 다음 복습일이 자동으로 정해져요.</p>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(RATING_LABEL) as Rating[]).map((r) => (
            <button
              key={r}
              disabled={!!busy}
              onClick={() => act(`rate-${r}`, async () => onChanged(await studyApi.studied(note.id, r, progress)))}
              className={cn('flex items-center justify-center gap-1 rounded-lg border border-border py-2 text-sm transition-colors disabled:opacity-50', RATING_STYLE[r])}
            >
              {busy === `rate-${r}` ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              {RATING_LABEL[r]}
            </button>
          ))}
        </div>
      </Card>

      <Card title="AI 학습 도우미" icon={Sparkles}>
        <div className="mb-3 flex flex-wrap gap-2">
          {AI_ACTIONS.map(({ action, label }) => (
            <Button key={action} variant="secondary" disabled={!!aiLoading} loading={aiLoading === action} onClick={() => runAi(action)} className="px-3 py-1.5 text-xs">
              {label}
            </Button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runAi('ask');
          }}
          className="flex gap-2"
        >
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="노트 내용에 대해 질문하기 (쉽게 설명할 개념을 적어도 돼요)" />
          <Button type="submit" disabled={!!aiLoading} loading={aiLoading === 'ask'} aria-label="질문하기">
            <Send className="size-4" />
          </Button>
        </form>

        {aiLoading && (
          <p className="mt-4 flex items-center gap-2 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" /> AI가 작성 중이에요… 보통 10~30초 걸려요.
          </p>
        )}
        {aiError && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{aiError}</p>}
        {aiResult && !aiLoading && (
          <div className="mt-4 rounded-xl border border-border p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
              <Badge className={aiResult.demo ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-violet-500/15 text-violet-600 dark:text-violet-400'}>
                <Bot className="mr-1 size-3" />
                {aiResult.demo ? '데모 응답' : `Claude (로컬)${aiResult.model ? ` · ${aiResult.model}` : ''}`}
              </Badge>
              <span className="text-muted">{aiResult.seconds}초</span>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(aiResult.text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                className="ml-auto flex items-center gap-1 text-muted hover:text-fg"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? '복사됨' : '복사'}
              </button>
            </div>
            <Markdown source={aiResult.text} />
            <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted">
              AI가 노트를 바탕으로 만든 내용이에요. “(노트 외 보충)” 표시는 노트에 없는 일반 지식이니 확인해보세요.
            </p>
          </div>
        )}
      </Card>

      <Modal open={!!notionDialog} onClose={() => setNotionDialog(null)} title="Notion에 저장할까요?">
        <p className="text-sm text-muted">
          {notionDialog === 'replace'
            ? '이 노트와 연결된 Notion 페이지의 본문을 지금 노트 내용으로 덮어써요. 기존 블록은 Notion 휴지통으로 이동하고, 그곳에서 복구할 수 있어요.'
            : '설정된 Notion 상위 페이지 아래에 이 노트로 새 페이지를 만들어요.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setNotionDialog(null)}>
            취소
          </Button>
          <Button variant={notionDialog === 'replace' ? 'danger' : 'primary'} onClick={() => exportNotion(notionDialog === 'replace')}>
            {notionDialog === 'replace' ? '덮어쓰기' : '저장'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

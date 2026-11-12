import { CalendarDays, Check, ListTodo, NotebookPen, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import AssistantActionDetails from '../components/AssistantActionDetails';
import { Button } from '../components/ui';
import { api, errorMessage, tokenStore } from '../lib/api';

type Action = { id: string; kind: string; targetTitle: string; payload: string };
type Result = { answer: string; actions: Action[]; ai: boolean };
const KIND: Record<string, { label: string; icon: typeof ListTodo }> = {
  task_create: { label: '할 일', icon: ListTodo },
  event_create: { label: '일정', icon: CalendarDays },
  note_create: { label: '학습 노트', icon: NotebookPen },
};
/** 데스크톱 앱이 창을 열 때 보내는 신호 (detail.token: 앱 창의 로그인) */
export const QUICK_OPEN_EVENT = 'devmata:quick-open';

/** 바깥 화면 위에 바로 닫는다. 데스크톱 앱은 창을 숨기고, 앱 창이 새 내용을 다시 불러오게 한다 */
const close = () => window.close();

/**
 * 빠른 입력: 어디서든 단축키(Ctrl+Shift+Space)로 여는 작은 창.
 * 한 줄을 적으면 AI가 할 일·일정·메모로 바꾸고, 확인(Enter)을 누르면 추가한다.
 */
export default function QuickCapturePage() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState(() => !!tokenStore.get());
  const input = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => { setText(''); setResult(undefined); setDone(0); setError(''); setBusy(false); setTimeout(() => input.current?.focus(), 0); }, []);
  useEffect(() => {
    const open = (event: Event) => {
      const token = (event as CustomEvent<{ token?: string }>).detail?.token;
      if (token) tokenStore.adopt(token);
      setSignedIn(!!tokenStore.get());
      reset();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener(QUICK_OPEN_EVENT, open);
    window.addEventListener('keydown', key);
    document.title = 'DevMata AI 빠른 입력';
    reset();
    return () => { window.removeEventListener(QUICK_OPEN_EVENT, open); window.removeEventListener('keydown', key); };
  }, [reset]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true); setError(''); setResult(undefined);
    try { setResult(await api.post<Result>('/assistant/quick', { text })); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  async function confirmAll() {
    if (!result) return;
    setBusy(true); setError('');
    try {
      for (const action of result.actions) await api.post(`/assistant/actions/${action.id}/confirm`);
      setDone(result.actions.length);
      setTimeout(close, 900);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return <div className="flex h-screen flex-col overflow-hidden bg-surface p-4 text-fg">
    <header className="mb-3 flex items-center gap-2 text-sm font-semibold"><Zap className="size-4 text-accent" />빠른 입력<span className="ml-auto text-xs font-normal text-muted">Esc 닫기</span></header>
    {!signedIn ? <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted"><p>DevMata AI 앱에서 먼저 로그인해 주세요.</p><p className="text-xs">로그인한 뒤 다시 단축키를 누르면 바로 쓸 수 있어요.</p></div> : <>
      <form onSubmit={submit}>
        <input ref={input} value={text} maxLength={500} disabled={busy || !!done} onChange={e => { setText(e.target.value); setResult(undefined); }} aria-label="빠른 입력" placeholder="예: 내일 오후 3시 팀 회의, 금요일까지 보고서 쓰기"
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-[15px] outline-none focus:border-accent" />
      </form>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {busy && !result && <p className="text-sm text-muted">AI가 정리하고 있어요…</p>}
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        {!result && !busy && !error && <p className="text-xs leading-5 text-muted">Enter를 누르면 AI가 할 일·일정·메모로 바꿔요. "매주 월요일 10시"처럼 쓰면 반복 일정이 돼요. 확인하기 전에는 아무것도 추가되지 않아요.</p>}
        {result && <div className="space-y-2">
          {result.answer && <p className="text-sm text-muted">{result.answer}</p>}
          {result.actions.map(action => { const kind = KIND[action.kind] ?? KIND.task_create; const Icon = kind.icon; return <div key={action.id} className="rounded-xl border border-border p-3">
            <p className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-accent" /><span className="text-xs text-muted">{kind.label}</span>{action.targetTitle}</p>
            <AssistantActionDetails payload={action.payload} />
          </div>; })}
        </div>}
      </div>
      {result && <footer className="mt-3 flex items-center justify-end gap-2">
        {done ? <p role="status" className="mr-auto flex items-center gap-1 text-sm text-accent"><Check className="size-4" />{done}개 추가했어요</p> : <>
          <Button variant="ghost" disabled={busy} onClick={reset}>다시 쓰기</Button>
          <Button autoFocus loading={busy} onClick={() => void confirmAll()}>{result.actions.length > 1 ? `모두 추가 (${result.actions.length}개)` : '추가'}</Button>
        </>}
      </footer>}
    </>}
  </div>;
}

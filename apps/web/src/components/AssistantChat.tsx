import { Bot, MessageSquarePlus } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { isPending, useAssistantChat, type AssistantAction } from '../context/AssistantChatContext';
import ActionDetails from './AssistantActionDetails';
import ChatModelPicker from './ChatModelPicker';
import Markdown from './Markdown';
import { Button, cn, EmptyState, ErrorState, Spinner, Textarea } from './ui';

export const actionLabels: Record<string, string> = {
  task_create: '할 일 추가', task_update: '할 일 수정', task_complete: '할 일 완료', task_rename: '할 일 제목 변경', task_delete: '할 일 삭제',
  event_create: '일정 추가', event_update: '일정 수정', event_delete: '일정 삭제',
  note_create: '학습 노트 추가', note_update: '학습 노트 수정', note_delete: '학습 노트 삭제',
  project_create: '프로젝트 추가', project_update: '프로젝트 수정', project_delete: '프로젝트와 하위 작업·보고서 삭제',
  item_create: '프로젝트 작업 추가', item_update: '프로젝트 작업 수정', item_delete: '프로젝트 작업 삭제',
};

function ActionCard({ action, busy, onResolve }: { action: AssistantAction; busy: boolean; onResolve: (confirm: boolean) => void }) {
  const pending = isPending(action);
  return <div className="mt-3 rounded-lg border border-amber-500/50 p-3">
    <p className="text-sm font-medium">변경 제안: {actionLabels[action.kind] ?? action.kind}</p>
    <p className="mt-1 break-words text-sm">대상: {action.targetTitle}</p>
    <ActionDetails payload={action.payload} />
    <p className="my-2 text-xs text-muted">{action.state || (pending ? `확인 전에는 변경되지 않습니다.${action.expiresAt ? ` ${new Date(action.expiresAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}까지 유효합니다.` : ''}` : '만료됨')}</p>
    {pending && <div className="flex gap-2">
      <Button disabled={busy} variant={action.kind.endsWith('delete') ? 'danger' : 'primary'} onClick={() => onResolve(true)}>확인하고 적용</Button>
      <Button disabled={busy} variant="secondary" onClick={() => onResolve(false)}>취소</Button>
    </div>}
  </div>;
}

/** AI 비서 대화. variant="panel" 은 오른쪽 AI 패널용 (높이를 꽉 채우고, 지금 보는 화면 주소를 함께 보낸다) */
export default function AssistantChat({ variant = 'page' }: { variant?: 'page' | 'panel' }) {
  const { messages, loading, busy, error, clearError, setChatModel, send, resolve, confirmAll, newChat } = useAssistantChat();
  const location = useLocation();
  const [input, setInput] = useState('');
  const [confirmNew, setConfirmNew] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const panel = variant === 'panel';

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, busy]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = input;
    if (!text.trim() || busy) return;
    setInput('');
    const ok = await send(text, panel ? location.pathname + location.search : undefined);
    if (!ok) setInput(text);
  }

  async function startNew() {
    setConfirmNew(false);
    await newChat();
  }

  return <div className={cn('flex flex-col', panel ? 'h-full min-h-0' : '')}>
    <div className="mb-3 flex flex-wrap items-start gap-2">
      <div className="min-w-0 flex-1"><ChatModelPicker busy={busy} onChange={setChatModel} /></div>
      <Button variant="secondary" disabled={busy || (!messages.length && !confirmNew)} onClick={() => messages.length ? setConfirmNew(true) : undefined} aria-label="새 채팅">
        <MessageSquarePlus className="size-4" /> 새 채팅
      </Button>
    </div>
    {confirmNew && <div role="alertdialog" aria-label="새 채팅 확인" className="mb-3 rounded-xl bg-surface-2 p-3 text-sm">
      <p>지금 대화를 지우고 새로 시작할까요? 확인하지 않은 변경 제안도 함께 취소돼요.</p>
      <div className="mt-2 flex gap-2"><Button disabled={busy} onClick={() => void startNew()}>새로 시작</Button><Button variant="secondary" onClick={() => setConfirmNew(false)}>취소</Button></div>
    </div>}
    <p className="mb-3 text-xs text-muted">대화는 <b>새 채팅</b>을 누르기 전까지 남아요. AI가 제안한 변경은 확인을 눌러야 적용돼요.</p>
    {error && <div className="mb-3"><ErrorState message={error} /><button type="button" onClick={clearError} className="mt-1 text-xs text-muted hover:text-accent">닫기</button></div>}

    <div className={cn('space-y-4 overflow-y-auto', panel ? 'min-h-0 flex-1 pr-1' : 'max-h-[36rem]')}>
      {loading ? <Spinner /> : !messages.length && <EmptyState icon={Bot} title="무엇을 도와드릴까요?" description={panel ? '지금 보고 있는 화면에 대해 묻거나, 일정·할 일·노트를 추가·수정해 달라고 해 보세요.' : '일정·학습·프로젝트에 관해 묻거나, 무엇이든 질문해 보세요.'} />}
      {messages.map((m, i) => {
        const pending = m.actions?.filter(isPending) ?? [];
        return <div key={m.id ?? i} className={cn('rounded-xl p-4', m.role === 'user' ? (panel ? 'ml-4' : 'ml-6') + ' bg-accent/10' : (panel ? 'mr-1' : 'mr-3') + ' bg-surface-2')}>
          <p className="mb-2 text-xs font-medium text-muted">{m.role === 'user' ? '나' : m.demo ? '비서 · DEMO (실제 AI 분석 아님)' : 'AI 비서'}</p>
          <Markdown source={m.content} />
          {pending.length > 1 && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface p-2.5 text-sm">
            <span className="flex-1">변경 제안 {pending.length}개</span>
            <Button disabled={busy} onClick={() => void confirmAll(pending)}>{pending.some(a => a.kind.endsWith('delete')) ? '삭제 포함 ' : ''}모두 확인하고 적용</Button>
          </div>}
          {m.actions?.map(a => <ActionCard key={a.id} action={a} busy={busy} onResolve={confirm => void resolve(a, confirm)} />)}
        </div>;
      })}
      {busy && <Spinner />}
      <div ref={end} />
    </div>

    <form className="mt-4 flex items-end gap-2" onSubmit={e => void submit(e)}>
      <Textarea required aria-label="비서에게 질문" maxLength={2000} rows={panel ? 2 : undefined} placeholder="무엇이든 물어보세요… (Enter 보내기 · Shift+Enter 줄바꿈)" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {
        // 한글 조합 중 Enter는 글자 확정용이므로 보내지 않는다
        if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        if (!busy && input.trim()) e.currentTarget.form?.requestSubmit();
      }} />
      <Button disabled={busy || !input.trim()} type="submit">보내기</Button>
    </form>
  </div>;
}

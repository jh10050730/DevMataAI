import { Maximize2, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useAssistantChat } from '../context/AssistantChatContext';
import AssistantChat from './AssistantChat';

/** 위쪽 "AI" 버튼. 누르면 오른쪽 AI 패널이 열리고 닫힌다 */
export function AssistantToggle() {
  const { panelOpen, setPanelOpen } = useAssistantChat();
  return <button
    onClick={() => setPanelOpen(open => !open)}
    aria-label={panelOpen ? 'AI 채팅 닫기' : 'AI 채팅 열기'}
    aria-expanded={panelOpen}
    aria-controls="assistant-panel"
    title="AI 채팅"
    className={'flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ' + (panelOpen ? 'bg-accent-strong text-white' : 'bg-accent-soft text-accent hover:bg-accent-strong hover:text-white')}
  >
    <Sparkles className="size-4" /> AI
  </button>;
}

/** 오른쪽 AI 패널. 넓은 화면에서는 본문 옆에 붙고, 좁은 화면에서는 화면을 덮는다 */
export default function AssistantPanel() {
  const { panelOpen, setPanelOpen } = useAssistantChat();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    ref.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanelOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panelOpen, setPanelOpen]);

  if (!panelOpen) return null;
  return <>
    {/* 1024px 이상: 본문을 옆으로 밀고, 본문은 줄어든 폭에 맞춰 칸을 다시 배치한다. 더 좁은 창(휴대폰 크기)에서만 위에 겹쳐 연다 */}
    <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setPanelOpen(false)} aria-hidden />
    <aside ref={ref} id="assistant-panel" aria-label="AI 채팅" className="fixed inset-y-0 right-0 z-50 flex w-[min(440px,100vw)] flex-col border-l border-border bg-surface shadow-2xl lg:static lg:z-auto lg:w-[340px] lg:shrink-0 lg:shadow-none xl:w-[380px] 2xl:w-[420px]">
      <div className="flex h-[72px] shrink-0 items-center gap-2 px-5">
        <Sparkles className="size-5 text-accent" />
        <h2 className="flex-1 text-base font-semibold">AI 비서</h2>
        <Link to="/assistant" onClick={() => setPanelOpen(false)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-accent" aria-label="AI 비서 화면에서 크게 보기" title="크게 보기"><Maximize2 className="size-4" /></Link>
        <button onClick={() => setPanelOpen(false)} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="AI 채팅 닫기"><X className="size-4" /></button>
      </div>
      <div className="min-h-0 flex-1 px-5 pb-5"><AssistantChat variant="panel" /></div>
    </aside>
  </>;
}

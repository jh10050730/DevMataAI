import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChatModel } from '../components/ChatModelPicker';
import { api, errorMessage } from '../lib/api';
import { notifyDataChanged } from '../lib/dataEvents';

/**
 * AI 비서 대화. AI 비서 화면과 오른쪽 AI 패널이 같은 대화를 쓴다.
 * 대화는 서버(DB)에 저장되므로 다른 화면에 다녀오거나 앱을 다시 켜도 남고, "새 채팅"을 눌러야 비워진다.
 */
export type AssistantAction = { id: string; kind: string; targetTitle: string; payload: string; expiresAt?: string; state?: string };
export type ChatMessage = { id?: string; role: 'user' | 'assistant'; content: string; demo?: boolean; actions?: AssistantAction[]; provider?: string; model?: string };
type ChatReply = { answer: string; demo: boolean; actions: AssistantAction[]; provider: string; model?: string };

interface AssistantChatValue {
  messages: ChatMessage[];
  loading: boolean;
  busy: boolean;
  error: string;
  clearError: () => void;
  setChatModel: (model: ChatModel) => void;
  /** 보내기. page 는 지금 보고 있는 화면 주소 (AI 가 "이 노트" 같은 말을 알아듣게) */
  send: (text: string, page?: string) => Promise<boolean>;
  resolve: (action: AssistantAction, confirm: boolean) => Promise<void>;
  /** 아직 확인하지 않은 제안을 차례로 모두 적용 */
  confirmAll: (actions: AssistantAction[]) => Promise<void>;
  newChat: () => Promise<void>;
  panelOpen: boolean;
  setPanelOpen: (open: boolean | ((open: boolean) => boolean)) => void;
}

const Ctx = createContext<AssistantChatValue | null>(null);

/** 아직 누를 수 있는 제안인지 */
export const isPending = (a: AssistantAction) => !a.state && (!a.expiresAt || Date.now() <= new Date(a.expiresAt).getTime());

export function AssistantChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const chatModel = useRef<ChatModel>({});
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    api.get<ChatMessage[]>('/assistant/messages')
      .then(rows => { if (active) setMessages(rows); })
      .catch(e => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const run = useCallback(async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
    if (busyRef.current) return undefined;
    busyRef.current = true; setBusy(true); setError('');
    try { return await work(); } catch (e) { setError(errorMessage(e)); return undefined; } finally { busyRef.current = false; setBusy(false); }
  }, []);

  const send = useCallback(async (text: string, page?: string) => {
    const message = text.trim();
    if (!message) return false;
    const sent = await run(async () => {
      setMessages(rows => [...rows, { role: 'user', content: message }]);
      try {
        const reply = await api.post<ChatReply>('/assistant/chat', { message, ...(page ? { page: page.slice(0, 300) } : {}), ...chatModel.current });
        setMessages(rows => [...rows, { role: 'assistant', content: reply.answer, demo: reply.demo, actions: reply.actions, provider: reply.provider, model: reply.model }]);
        return true;
      } catch (e) {
        // 저장되지 않은 질문은 화면에서도 뺀다 (입력창에 되돌려 다시 보낼 수 있게)
        setMessages(rows => rows.slice(0, -1));
        throw e;
      }
    });
    return !!sent;
  }, [run]);

  const mark = (id: string, state: string) => setMessages(rows => rows.map(m => m.actions?.some(a => a.id === id) ? { ...m, actions: m.actions.map(a => a.id === id ? { ...a, state } : a) } : m));

  const resolve = useCallback(async (action: AssistantAction, confirm: boolean) => {
    await run(async () => {
      await api.post(`/assistant/actions/${action.id}/${confirm ? 'confirm' : 'cancel'}`);
      mark(action.id, confirm ? '적용 완료' : '취소됨');
      if (confirm) notifyDataChanged();
    });
  }, [run]);

  const confirmAll = useCallback(async (actions: AssistantAction[]) => {
    await run(async () => {
      let applied = 0;
      try {
        for (const action of actions.filter(isPending)) {
          await api.post(`/assistant/actions/${action.id}/confirm`);
          mark(action.id, '적용 완료');
          applied++;
        }
      } finally {
        if (applied) notifyDataChanged();
      }
    });
  }, [run]);

  const newChat = useCallback(async () => {
    await run(async () => {
      await api.delete('/assistant/messages');
      setMessages([]);
    });
  }, [run]);

  const value = useMemo<AssistantChatValue>(() => ({
    messages, loading, busy, error, clearError: () => setError(''),
    setChatModel: model => { chatModel.current = model; },
    send, resolve, confirmAll, newChat, panelOpen, setPanelOpen,
  }), [messages, loading, busy, error, send, resolve, confirmAll, newChat, panelOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssistantChat() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useAssistantChat 는 AssistantChatProvider 안에서만 쓸 수 있어요.');
  return value;
}

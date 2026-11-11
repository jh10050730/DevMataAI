import { Bot, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, errorMessage } from '../lib/api';
import { Button, Card, Spinner } from './ui';
type Account = { enabled: boolean; connected: boolean; email?: string; pending: boolean; message: string; migrationRequired?: boolean };
type ClaudeAccount = { connected: boolean; loginConnected: boolean; enabled: boolean; email?: string; installed: boolean; message: string };
type Connections = { claude: ClaudeAccount; chatgpt: Account; gemini?: Account; providers: string[]; defaultProvider?: string };
type Actions = { connect: () => void; cancel: () => void; disconnect: () => void; refresh: () => void };
export function AiAccountTabs({ selected, connected, busy, onSelect }: { selected: string; connected: string[]; busy: boolean; onSelect: (provider: string) => void }) {
  return <div className="mb-4 flex flex-wrap gap-3">{[['claude-cli', 'Claude'], ['chatgpt', 'ChatGPT'], ['gemini', 'Gemini']].map(([provider, label]) => <Button key={provider} disabled={busy} variant={selected === provider ? 'primary' : 'secondary'} aria-pressed={selected === provider} onClick={() => onSelect(provider)}>{label}{connected.includes(provider) && <span className="text-xs opacity-80"> · 연결됨</span>}</Button>)}</div>;
}
function ConnectedAccount({ name, email, busy, disconnect, refresh }: { name: string; email?: string; busy: boolean; disconnect: () => void; refresh: () => void }) {
  return <div className="space-y-3">
    <p role="status" className="text-sm text-accent">{name} 연결됨</p>
    {email && <p className="break-all text-sm text-muted">{email}</p>}
    <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={disconnect}>계정 연결 해제</Button><Button variant="secondary" disabled={busy} onClick={refresh}>연결 상태 다시 확인</Button></div>
    <p className="text-xs text-muted">연결 해제는 이 앱에만 적용됩니다. 모델은 AI 비서 채팅에서 선택할 수 있습니다.</p>
  </div>;
}
export function ClaudeConnection({ account, busy, connect, disconnect, refresh }: { account: ClaudeAccount; busy: boolean; connect: () => void; disconnect: () => void; refresh: () => void }) {
  if (account.connected) return <ConnectedAccount name="Claude" email={account.email} busy={busy} disconnect={disconnect} refresh={refresh} />;
  return <div className="space-y-3">
    <p role="status" className={account.connected ? 'text-sm text-accent' : 'text-sm text-muted'}>{account.connected ? 'Claude 연결됨' : account.message}</p>
    {account.connected && account.email && <p className="break-all text-sm text-muted">{account.email}</p>}
    <div className="flex flex-wrap gap-2">
      {account.connected ? <Button variant="secondary" disabled={busy} onClick={disconnect}>계정 연결 해제</Button> : account.loginConnected ? <Button disabled={busy} onClick={connect}>Claude 연결</Button> : <Link to="/claude-setup" className="inline-flex items-center text-sm text-accent">Claude 설치·로그인 안내 →</Link>}
      <Button variant="secondary" disabled={busy} onClick={refresh}>연결 상태 다시 확인</Button>
    </div>
    {account.connected && <p className="text-xs text-muted">연결 해제는 이 앱에만 적용됩니다.</p>}
  </div>;
}

export function ChatGptConnection({ account, busy, loginUrl, actions }: { account: Account; busy: boolean; loginUrl: string; actions: Actions }) {
  if (account.connected) return <ConnectedAccount name="ChatGPT" email={account.email} busy={busy} disconnect={actions.disconnect} refresh={actions.refresh} />;
  return <div className="space-y-4">
    {account.connected ? <div className="space-y-2"><p role="status" className="text-sm text-accent">ChatGPT 연결됨</p><p className="break-all text-sm text-muted">{account.email || '본인 ChatGPT 계정'}</p></div> : <p role="status" className="text-sm leading-6 text-muted">{account.pending ? '브라우저에서 ChatGPT 로그인을 완료해 주세요.' : account.message}</p>}
    {!account.enabled && <div className="space-y-2"><p className="text-sm text-muted">ChatGPT 연결 프로그램을 설치한 뒤 앱을 다시 시작하세요. 설치 후에도 감지되지 않으면 관리자 앱 연결 설정에서 실행 경로를 확인해 주세요.</p><a className="inline-flex items-center gap-1 text-sm text-accent" href="https://developers.openai.com/codex/cli" target="_blank" rel="noopener noreferrer">ChatGPT 연결 프로그램 설치 안내<ExternalLink className="size-3.5" /></a></div>}
    <div className="flex flex-wrap gap-2">
      {!account.connected && <Button disabled={busy || !account.enabled || account.pending} onClick={actions.connect}>ChatGPT로 로그인</Button>}
      {account.pending && <Button variant="secondary" disabled={busy} onClick={actions.cancel}>로그인 취소</Button>}
      {account.connected && <Button variant="secondary" disabled={busy} onClick={actions.disconnect}>계정 연결 해제</Button>}
      <Button variant="secondary" disabled={busy} onClick={actions.refresh}>연결 상태 다시 확인</Button>
    </div>
    {loginUrl && account.pending && <a className="inline-flex items-center gap-2 text-sm font-semibold text-accent" href={loginUrl} target="_blank" rel="noopener noreferrer">브라우저에서 ChatGPT 로그인 계속하기<ExternalLink className="size-4" /></a>}
    {account.connected && <p className="text-xs text-muted">다른 계정을 사용하려면 연결을 해제한 뒤 다시 로그인하세요. 사용할 모델은 AI 비서 채팅에서 선택할 수 있습니다.</p>}
  </div>;
}

export function GeminiConnection({ account, busy, actions }: { account: Account; busy: boolean; actions: Actions }) {
  if (account.connected) return <ConnectedAccount name="Gemini" email={account.email} busy={busy} disconnect={actions.disconnect} refresh={actions.refresh} />;
  return <div className="space-y-3">
    <p role="status" className="text-sm leading-6 text-muted">{account.pending ? '브라우저에서 Google 계정 로그인을 완료해 주세요.' : account.message}</p>
    {account.migrationRequired && <a className="inline-flex items-center gap-1 text-sm text-accent" href="https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals" target="_blank" rel="noopener noreferrer">Google 개인 계정 지원 종료 안내<ExternalLink className="size-3.5" /></a>}
    {!account.enabled && <a className="inline-flex items-center gap-1 text-sm text-accent" href="https://antigravity.google/docs/quickstart?tab=cli" target="_blank" rel="noopener noreferrer">Gemini 연결 프로그램 설치 안내<ExternalLink className="size-3.5" /></a>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy || !account.enabled || account.pending} onClick={actions.connect}>Google 계정으로 Gemini 연결</Button>{account.pending && <Button variant="secondary" disabled={busy} onClick={actions.cancel}>로그인 취소</Button>}<Button variant="secondary" disabled={busy} onClick={actions.refresh}>연결 상태 다시 확인</Button></div>
    <p className="text-xs text-muted">Gemini는 Google의 Antigravity 연결 프로그램을 사용합니다. 무료 Google 계정으로 연결할 수 있으며 계정의 모델과 사용 한도가 적용됩니다.</p>
  </div>;
}

export default function AiAccountCard({ onSelection }: { onSelection?: (provider: string) => void }) {
  const [selected, setSelected] = useState('');
  const [account, setAccount] = useState<Account>();
  const [connections, setConnections] = useState<Connections>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loginUrl, setLoginUrl] = useState('');
  async function load() {
    const result = await api.get<Connections>('/ai/connections');
    setConnections(result); setAccount(result.chatgpt);
    if (!result.chatgpt.pending) setLoginUrl('');
  }
  useEffect(() => { let active = true; api.get<Connections>('/ai/connections').then(result => { if (active) { const tab = result.defaultProvider || 'claude-cli'; setSelected(tab); setConnections(result); setAccount(result.chatgpt); onSelection?.(tab); } }).catch(e => { if (active) setError(errorMessage(e)); }); return () => { active = false; }; }, []);
  useEffect(() => { const refresh = () => { void load().catch(e => setError(errorMessage(e))); }; window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, []);
  useEffect(() => {
    if (!account?.pending && !connections?.gemini?.pending) return;
    const timer = setInterval(() => { void load().catch(e => setError(errorMessage(e))); }, 2000);
    return () => clearInterval(timer);
  }, [account?.pending, connections?.gemini?.pending]);
  async function act(action: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await action(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }
  const actions: Actions = {
    connect: () => void act(async () => { const result = await api.post<{ url: string }>('/ai/chatgpt/connect'); const url = new URL(result.url); if (!['https://auth.openai.com', 'https://chatgpt.com'].includes(url.origin)) throw new Error('로그인 주소가 올바르지 않습니다.'); setLoginUrl(url.href); await load(); }),
    cancel: () => void act(async () => { await api.post('/ai/chatgpt/cancel'); setLoginUrl(''); await load(); }),
    disconnect: () => void act(async () => { const result = await api.post<{ message: string }>('/ai/chatgpt/disconnect'); setMessage(result.message); await load(); }),
    refresh: () => void act(load),
  };
  const geminiActions: Actions = {
    connect: () => void act(async () => { const result = await api.post<{ message: string }>('/ai/gemini/connect'); setMessage(result.message); await load(); }),
    cancel: () => void act(async () => { await api.post('/ai/gemini/cancel'); await load(); }),
    disconnect: () => void act(async () => { const result = await api.post<{ message: string }>('/ai/gemini/disconnect'); setMessage(result.message); await load(); }),
    refresh: () => void act(load),
  };
  return <Card title="내 AI 계정 선택" icon={Bot}>
    <p className="mb-4 text-sm leading-6 text-muted">서비스별 계정을 연결하세요. 채팅에는 연결된 계정의 모델이 모두 표시됩니다. 탭을 바꿔도 다른 계정의 연결은 유지됩니다.</p>
    {!account && !error ? <Spinner /> : <>
      <AiAccountTabs selected={selected} connected={connections?.providers ?? []} busy={busy} onSelect={provider => { setSelected(provider); onSelection?.(provider); setError(''); setMessage(''); }} />
      {selected === 'claude-cli' && connections && <ClaudeConnection account={connections.claude} busy={busy} connect={() => void act(async () => { const result = await api.post<{ message: string }>('/ai/claude-code/connect'); setMessage(result.message); await load(); })} disconnect={() => void act(async () => { const result = await api.post<{ message: string }>('/ai/claude-code/disconnect'); setMessage(result.message); await load(); })} refresh={() => void act(load)} />}
      {selected === 'chatgpt' && account && <ChatGptConnection account={account} busy={busy} loginUrl={loginUrl} actions={actions} />}
      {selected === 'gemini' && connections?.gemini && <GeminiConnection account={connections.gemini} busy={busy} actions={geminiActions} />}
    </>}
    {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm text-accent">{message}</p>}
  </Card>;
}

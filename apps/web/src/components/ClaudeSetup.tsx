import { Bot, CheckCircle2, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { Button, Card, Spinner } from './ui';
import AiAccountCard from './AiAccountCard';

type Status = { installed: boolean; version?: string; provider: string; message?: string };
const key = (id: string) => `devmate-claude-onboarding-v1:${id}`;
export default function ClaudeSetup({ onComplete }: { onComplete?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [selected, setSelected] = useState('claude-cli');
  useEffect(() => { setVerified(false); setResult(''); }, [selected]);
  async function check() {
    setLoading(true); setError(''); setVerified(false); setResult('');
    try { setStatus(await api.get<Status>('/ai/claude-code')); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { let active = true; api.get<Status>('/ai/claude-code').then(value => { if (active) setStatus(value); }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  async function test() {
    setTesting(true); setVerified(false); setError(''); setResult('');
    try {
      const response = await api.post<{ demo: boolean; provider: string; text: string }>('/ai/claude-code/test');
      if (response.demo || response.provider !== 'claude-cli' || !response.text.trim()) { setError('실제 Claude Code 응답이 아닙니다. 현재 AI 제공자 설정을 확인해 주세요.'); return; }
      setVerified(true); setResult('Claude Code가 응답했습니다. AI 기능을 사용할 수 있어요.');
    } catch (e) { setError(errorMessage(e)); }
    finally { setTesting(false); }
  }
  function finish() {
    if (user) { try { localStorage.setItem(key(user.id), verified ? 'connected' : 'skipped'); } catch { /* Keep this launch usable if storage is disabled. */ } }
    if (onComplete) onComplete(); else navigate('/');
  }
  return <div className="mx-auto w-full max-w-2xl space-y-6 p-5 py-10 sm:p-8">
    <header><p className="mb-3 text-sm font-semibold text-accent">DevMata AI · 시작하기</p><h1 className="text-3xl font-bold">내 AI 계정 연결하기</h1><p className="mt-3 text-sm leading-6 text-muted">Claude, ChatGPT 또는 Gemini를 본인 계정으로 연결해 주세요.</p></header>
    <AiAccountCard onSelection={setSelected} />
    {selected === 'claude-cli' && <>
    <Card title="1. Claude Code 설치 확인" icon={Download}>
      {loading ? <Spinner /> : <p role="status" className="mb-4 text-sm">{status?.installed ? `설치 확인됨 · 버전 ${status.version}` : status?.message || '설치 상태를 확인하지 못했습니다.'}</p>}
      <div className="flex flex-wrap gap-3"><a href="https://code.claude.com/docs/en/setup" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent-soft px-4 text-sm font-semibold text-accent">공식 설치 안내<ExternalLink className="size-4" /></a><Button variant="secondary" disabled={loading || testing} onClick={() => void check()}><RefreshCw className="size-4" />다시 확인</Button></div>
      <p className="mt-4 text-xs leading-5 text-muted">Windows용 공식 안내에 따라 설치한 뒤 DevMata AI를 다시 실행해 주세요. Claude Code는 앱에 포함되어 있지 않습니다.</p>
    </Card>
    <Card title="2. 본인 Claude 계정으로 로그인" icon={Bot}>
      <p className="text-sm leading-6 text-muted">터미널에서 아래 명령을 실행하고 Claude Code의 브라우저 안내에 따라 로그인해 주세요. Claude Code를 사용할 수 있는 계정이 필요합니다.</p><code className="my-4 block rounded-xl bg-surface-2 px-4 py-3 text-sm">claude</code>
      <p className="text-xs leading-5 text-muted">로그인은 공식 Claude Code에서 직접 진행합니다. DevMata AI에 Claude 비밀번호나 인증 코드를 입력하지 마세요.</p>
    </Card>
    <Card title="3. 연결 테스트" icon={CheckCircle2}>
      <p className="mb-4 text-sm leading-6 text-muted">버튼을 누르면 짧은 AI 요청으로 연결을 확인합니다. Claude 사용량이 소모될 수 있어요. 설치 확인만으로는 로그인 여부를 알 수 없습니다.</p>
      <Button loading={testing} disabled={loading || !status?.installed || selected !== 'claude-cli'} onClick={() => void test()}>Claude 연결 테스트</Button>
      {result && <p role="status" className="mt-3 text-sm text-accent">{result}</p>}
    </Card>
    </>}
    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-sm text-red-500">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><Button variant={verified ? 'primary' : 'secondary'} disabled={testing} onClick={finish}>{verified || ['chatgpt', 'gemini'].includes(selected) ? 'DevMata AI 시작하기' : '나중에 연결하고 시작하기'}</Button><span className="text-sm text-muted">시작한 뒤 설정에서 다시 연결할 수 있어요</span></div>
  </div>;
}

export function ClaudeOnboardingGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [done, setDone] = useState(() => { try { return !!user && !!localStorage.getItem(key(user.id)); } catch { return false; } });
  return done ? <>{children}</> : <ClaudeSetup onComplete={() => setDone(true)} />;
}

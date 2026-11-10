import { KeyRound, Mail, CheckCircle2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { api, errorMessage } from '../lib/api';
import { emailDomainError } from '../lib/email';
import { useAuth } from '../context/AuthContext';
import { Button, Field, Input } from '../components/ui';

export default function PasswordResetPage({ mode }: { mode: 'request' | 'reset' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token') ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const reset = mode === 'reset';
  const invalidLink = reset && !/^[a-f0-9]{64}$/.test(token);
  useEffect(() => { if (reset && location.hash) navigate('/reset-password', { replace: true }); }, [reset, location.hash, navigate]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!reset && emailDomainError(email)) { setError(emailDomainError(email)!); return; }
    if (reset && password !== confirmation) { setError('비밀번호가 일치하지 않습니다.'); return; }
    if (reset && new TextEncoder().encode(password).length > 72) { setError('비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.'); return; }
    setBusy(true);
    try {
      const result = reset
        ? await api.post<{ message: string }>('/auth/reset-password', { token, password, passwordConfirmation: confirmation })
        : await api.post<{ message: string }>('/auth/forgot-password', { email });
      if (reset) { logout(); setPassword(''); setConfirmation(''); }
      setMessage(result.message);
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  const Icon = message ? CheckCircle2 : reset ? KeyRound : Mail;
  return <div className="flex min-h-full items-center justify-center bg-bg p-5"><section className="workspace-card w-full max-w-md rounded-[28px] bg-surface p-8">
    <Link to="/login" className="text-xl font-bold">DevMata</Link>
    <div className="mb-6 mt-8"><Icon className="mb-4 size-9 text-accent" /><h1 className="text-2xl font-bold">{reset ? '새 비밀번호 설정' : '비밀번호 찾기'}</h1><p className="mt-2 text-sm leading-6 text-muted">{reset ? '새 비밀번호를 입력해 주세요. 변경 후 모든 기기에서 다시 로그인해야 합니다.' : '가입한 이메일로 비밀번호 재설정 링크를 보내드려요. 링크는 15분 동안 사용할 수 있어요.'}</p></div>
    {invalidLink ? <p role="alert" className="text-sm text-red-500">재설정 링크가 올바르지 않습니다. 메일의 링크를 다시 열거나 새 링크를 요청해 주세요.</p> : message ? <p role="status" className="rounded-2xl bg-accent-soft p-4 text-sm leading-6">{message}</p> : <form className="space-y-4" onSubmit={submit}>
      {reset ? <>
        <Field label="새 비밀번호" hint="8자 이상"><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" /></Field>
        <Field label="새 비밀번호 확인"><Input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" /></Field>
      </> : <Field label="이메일"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} autoComplete="email" placeholder="가입한 이메일을 입력해 주세요" /></Field>}
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <Button type="submit" loading={busy} className="w-full">{reset ? '비밀번호 변경' : '재설정 링크 보내기'}</Button>
    </form>}
    {message && !reset && <Button variant="secondary" className="mt-4 w-full" onClick={() => { setMessage(''); setError(''); }}>다른 이메일 입력 / 다시 요청</Button>}
    <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm"><Link to="/login" className="text-muted hover:text-accent">로그인으로 돌아가기</Link>{reset && <Link to="/forgot-password" className="text-accent">새 링크 요청</Link>}</div>
  </section></div>;
}

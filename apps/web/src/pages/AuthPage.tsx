import { BadgeCheck, Layers3 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import GoogleVerify from '../components/GoogleVerify';
import { Button, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';
import { emailDomainError } from '../lib/email';
import { identityApi, type IdentityDone } from '../lib/googleIdentity';
import { useAsync } from '../lib/useAsync';

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isLogin = mode === 'login';
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => (isLogin ? ((location.state as { email?: string } | null)?.email ?? '') : ''));
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 회원가입: Google 로 확인한 이메일 (Google 키가 있는 앱에서는 먼저 확인해야 가입할 수 있다)
  const { data: google, loading: googleLoading } = useAsync(() => (isLogin ? Promise.resolve(null) : identityApi.available().catch(() => null)), [isLogin]);
  const [verified, setVerified] = useState<IdentityDone | null>(null);
  const needsGoogle = !isLogin && !!google?.available;

  const onVerified = (result: IdentityDone) => {
    setVerified(result);
    setEmail(result.email);
    if (!name.trim() && result.name) setName(result.name);
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isLogin && !needsGoogle && emailDomainError(email)) return setError(emailDomainError(email));
    if (!isLogin && password.length < 6) return setError('비밀번호는 6자 이상이어야 합니다.');
    if (!isLogin && password !== passwordConfirmation) return setError('비밀번호가 일치하지 않습니다. 다시 확인해 주세요.');
    setSubmitting(true);
    try {
      if (isLogin) await login(email, password, remember);
      else await register(name, email, password, verified?.ticket);
    } catch (err) {
      setError(errorMessage(err));
      // 확인 표는 한 번만 쓸 수 있으므로, 가입이 실패하면 다시 확인하게 한다
      if (!isLogin && verified) setVerified(null);
    } finally {
      setSubmitting(false);
    }
  };

  const showForm = isLogin || (!googleLoading && (!needsGoogle || (verified && !verified.exists)));

  return (
    <div className="flex min-h-full items-center justify-center bg-bg p-5">
      <div className="workspace-card w-full max-w-sm rounded-[28px] bg-surface p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-accent-strong p-3.5">
            <Layers3 className="size-6 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">DevMata AI</h1>
            <p className="mt-1 text-sm text-muted">{isLogin ? '다시 오신 걸 환영해요' : '나만의 AI 워크스페이스 만들기'}</p>
          </div>
        </div>

        {!isLogin && needsGoogle && !verified && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-surface-2 p-4 text-sm leading-6 text-muted">
              <p className="font-semibold text-fg">1단계 · Google로 이메일 확인</p>
              <p className="mt-1">가입할 이메일이 내 것인지 Google 계정으로 확인해요. 이메일·이름만 확인하고 다른 정보는 가져오지 않아요.</p>
            </div>
            <GoogleVerify purpose="signup" label="Google로 이메일 확인" onDone={onVerified} />
            {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        )}

        {!isLogin && verified?.exists && (
          <div className="space-y-3" role="status">
            <p className="rounded-2xl bg-accent-soft p-4 text-sm leading-6"><b>{verified.email}</b>은(는) 이미 가입된 이메일이에요. 로그인하거나 비밀번호를 찾아 주세요.</p>
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={() => navigate('/login', { state: { email: verified.email } })}>로그인</Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate('/forgot-password')}>비밀번호 찾기</Button>
            </div>
            <button type="button" onClick={() => setVerified(null)} className="w-full text-center text-sm text-muted hover:text-accent">다른 Google 계정으로 확인</button>
          </div>
        )}

        {showForm && (
          <form onSubmit={onSubmit} className="space-y-4">
            {!isLogin && verified && (
              <p className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-400">
                <BadgeCheck className="size-4 shrink-0" /> Google로 확인한 이메일이에요
              </p>
            )}
            {!isLogin && (
              <Field label="이름">
                <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} autoComplete="name" />
              </Field>
            )}
            <Field label={isLogin ? '아이디 (이메일)' : '이메일'}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" readOnly={!isLogin && !!verified} aria-invalid={!isLogin && !verified && !!emailDomainError(email)} aria-describedby={!isLogin && !verified && emailDomainError(email) ? 'email-domain-error' : undefined} />
            </Field>
            {!isLogin && !verified && emailDomainError(email) && <p id="email-domain-error" className="text-xs text-red-500">{emailDomainError(email)}</p>}
            <Field label="비밀번호" hint={isLogin ? undefined : '6자 이상'}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={72}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
            </Field>
            {!isLogin && <Field label="비밀번호 확인">
              <Input type="password" value={passwordConfirmation} onChange={e => setPasswordConfirmation(e.target.value)} required maxLength={72} autoComplete="new-password" placeholder="비밀번호를 한 번 더 입력해 주세요" />
            </Field>}
            {isLogin && <div className="space-y-1.5">
              <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} disabled={submitting} className="size-4 accent-accent-strong" aria-describedby="remember-login-hint" />
                자동 로그인
              </label>
              <p id="remember-login-hint" className="text-xs leading-5 text-muted">{remember ? '이 브라우저에서 로그인을 유지해요. 개인 기기에서만 선택해 주세요.' : '사이트를 나가거나 탭을 닫으면 다시 로그인해야 해요.'}</p>
            </div>}
            {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button type="submit" loading={submitting} className="w-full">
              {isLogin ? '로그인' : '회원가입'}
            </Button>
            {!isLogin && verified && <button type="button" onClick={() => setVerified(null)} className="w-full text-center text-sm text-muted hover:text-accent">다른 Google 계정으로 확인</button>}
          </form>
        )}

        {isLogin && (
          <p className="mt-4 flex justify-center gap-3 text-sm text-muted">
            <Link to="/find-account" className="hover:text-accent">아이디 찾기</Link>
            <span aria-hidden>·</span>
            <Link to="/forgot-password" className="hover:text-accent">비밀번호 찾기</Link>
          </p>
        )}

        <p className="mt-5 text-center text-sm text-muted">
          {isLogin ? '처음이신가요? ' : '이미 계정이 있나요? '}
          <Link to={isLogin ? '/register' : '/login'} className="font-medium text-accent hover:underline">
            {isLogin ? '회원가입' : '로그인'}
          </Link>
        </p>
      </div>
    </div>
  );
}

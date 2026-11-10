import { Layers3 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';
import { emailDomainError } from '../lib/email';

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isLogin = mode === 'login';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isLogin && emailDomainError(email)) return setError(emailDomainError(email));
    if (!isLogin && password.length < 8) return setError('비밀번호는 8자 이상이어야 합니다.');
    if (!isLogin && password !== passwordConfirmation) return setError('비밀번호가 일치하지 않습니다. 다시 확인해 주세요.');
    setSubmitting(true);
    try {
      if (isLogin) await login(email, password, remember);
      else await register(name, email, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-bg p-5">
      <div className="workspace-card w-full max-w-sm rounded-[28px] bg-surface p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-accent-strong p-3.5">
            <Layers3 className="size-6 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">DevMata</h1>
            <p className="mt-1 text-sm text-muted">{isLogin ? '다시 오신 걸 환영해요' : '나만의 AI 워크스페이스 만들기'}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {!isLogin && (
            <Field label="이름">
              <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} autoComplete="name" />
            </Field>
          )}
          <Field label="이메일">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" aria-invalid={!isLogin && !!emailDomainError(email)} aria-describedby={!isLogin && emailDomainError(email) ? 'email-domain-error' : undefined} />
          </Field>
          {!isLogin && emailDomainError(email) && <p id="email-domain-error" className="text-xs text-red-500">{emailDomainError(email)}</p>}
          <Field label="비밀번호" hint={isLogin ? undefined : '8자 이상'}>
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
        </form>

        {isLogin && <p className="mt-4 text-center"><Link to="/forgot-password" className="text-sm text-muted hover:text-accent">비밀번호를 잊으셨나요?</Link></p>}

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

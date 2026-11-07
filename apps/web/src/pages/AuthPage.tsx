import { Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isLogin = mode === 'login';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isLogin && password.length < 8) return setError('비밀번호는 8자 이상이어야 합니다.');
    setSubmitting(true);
    try {
      if (isLogin) await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-blue-600/10 via-bg to-violet-600/10 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-7 shadow-xl shadow-black/10">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 p-2.5">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">DevMate AI</h1>
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
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
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
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" loading={submitting} className="w-full">
            {isLogin ? '로그인' : '회원가입'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          {isLogin ? '처음이신가요? ' : '이미 계정이 있나요? '}
          <Link to={isLogin ? '/register' : '/login'} className="font-medium text-blue-500 hover:underline">
            {isLogin ? '회원가입' : '로그인'}
          </Link>
        </p>
      </div>
    </div>
  );
}

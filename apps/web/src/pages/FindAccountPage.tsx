import { CheckCircle2, UserSearch } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import GoogleVerify from '../components/GoogleVerify';
import { Button } from '../components/ui';
import { identityApi, type IdentityDone } from '../lib/googleIdentity';
import { useAsync } from '../lib/useAsync';

/** 아이디 찾기: 아이디는 가입한 이메일이다. Google 로 본인 확인하면 그 이메일로 가입된 계정이 있는지 알려 준다 */
export default function FindAccountPage() {
  const navigate = useNavigate();
  const { data: google, loading } = useAsync(() => identityApi.available().catch(() => null), []);
  const [found, setFound] = useState<IdentityDone | null>(null);

  return (
    <div className="flex min-h-full items-center justify-center bg-bg p-5">
      <section className="workspace-card w-full max-w-md rounded-[28px] bg-surface p-8">
        <Link to="/login" className="text-xl font-bold">DevMata AI</Link>
        <div className="mb-6 mt-8">
          {found?.exists ? <CheckCircle2 className="mb-4 size-9 text-accent" /> : <UserSearch className="mb-4 size-9 text-accent" />}
          <h1 className="text-2xl font-bold">아이디 찾기</h1>
          <p className="mt-2 text-sm leading-6 text-muted">DevMata AI의 아이디는 가입할 때 쓴 이메일이에요. Google 계정으로 본인 확인하면 가입된 아이디를 알려 드려요.</p>
        </div>

        {found ? (
          <div className="space-y-3" role="status">
            {found.exists ? (
              <>
                <p className="rounded-2xl bg-accent-soft p-4 text-sm leading-6">가입된 아이디는 <b className="break-all">{found.email}</b> 예요.</p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => navigate('/login', { state: { email: found.email } })}>이 아이디로 로그인</Button>
                  <Button variant="secondary" className="flex-1" onClick={() => navigate('/forgot-password')}>비밀번호 찾기</Button>
                </div>
              </>
            ) : (
              <>
                <p className="rounded-2xl bg-surface-2 p-4 text-sm leading-6"><b className="break-all">{found.email}</b>(으)로 가입된 계정이 이 PC에 없어요.</p>
                <Button className="w-full" onClick={() => navigate('/register')}>회원가입</Button>
              </>
            )}
            <button type="button" onClick={() => setFound(null)} className="w-full text-center text-sm text-muted hover:text-accent">다른 Google 계정으로 확인</button>
          </div>
        ) : loading ? null : google?.available ? (
          <GoogleVerify purpose="find" label="Google로 본인 확인" onDone={setFound} />
        ) : (
          <p className="rounded-2xl bg-surface-2 p-4 text-sm leading-6 text-muted">이 앱에는 Google 연동 키가 없어 Google 확인을 쓸 수 없어요. 가입할 때 쓴 이메일로 로그인해 보시고, 기억나지 않으면 처음 가입한 관리자에게 물어보세요.</p>
        )}

        <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm">
          <Link to="/login" className="text-muted hover:text-accent">로그인으로 돌아가기</Link>
          <Link to="/forgot-password" className="text-accent">비밀번호 찾기</Link>
        </div>
      </section>
    </div>
  );
}

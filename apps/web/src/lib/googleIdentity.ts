import { api } from './api';

/** Google 본인 확인 (회원가입·비밀번호 찾기·아이디 찾기). apps/api/src/auth/google-identity.service.ts 와 짝 */
export type IdentityPurpose = 'signup' | 'reset' | 'find';

export type IdentityResult =
  | { status: 'pending' }
  | { status: 'error'; message: string }
  | { status: 'done'; purpose: IdentityPurpose; email: string; name: string; exists: boolean; ticket?: string; resetPath?: string };

export type IdentityDone = Extract<IdentityResult, { status: 'done' }>;

export const identityApi = {
  available: () => api.get<{ available: boolean; requiredForSignup: boolean }>('/auth/google/available'),
  start: (purpose: IdentityPurpose) => api.post<{ url: string; requestId: string }>('/auth/google/start', { purpose }),
  result: (requestId: string) => api.get<IdentityResult>(`/auth/google/result/${encodeURIComponent(requestId)}`),
};

export const POLL_MS = 1500;
export const WAIT_MS = 10 * 60_000;

interface Options {
  signal?: AbortSignal;
  /** Google 로그인 주소 열기. 데스크톱 앱에서는 기본 브라우저로 열린다 */
  open?: (url: string) => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  start?: typeof identityApi.start;
  result?: typeof identityApi.result;
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Google 로그인 창을 열고, 확인이 끝날 때까지 결과를 기다린다. 취소·실패·시간 초과는 오류로 던진다 */
export async function verifyWithGoogle(purpose: IdentityPurpose, options: Options = {}): Promise<IdentityDone> {
  const { signal, open = url => { window.open(url, '_blank', 'noopener'); }, sleep = wait, now = Date.now, start = identityApi.start, result = identityApi.result } = options;
  const { url, requestId } = await start(purpose);
  open(url);
  const deadline = now() + WAIT_MS;
  while (now() < deadline) {
    await sleep(POLL_MS);
    if (signal?.aborted) throw new Error('Google 확인을 취소했어요.');
    const r = await result(requestId);
    if (r.status === 'done') return r;
    if (r.status === 'error') throw new Error(r.message);
  }
  throw new Error('Google 확인 시간이 지났어요. 다시 시도해 주세요.');
}

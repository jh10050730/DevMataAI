import { createTokenStore } from './token-store';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
export const tokenStore = createTokenStore(() => localStorage, () => sessionStorage, navigation?.type ?? 'navigate');

/** 세션 만료 시 AuthContext 가 구독 */
export const UNAUTHORIZED_EVENT = 'devmate:unauthorized';
/** 서버에 연결하지 못했을 때 ConnectionBanner 가 구독 */
export const OFFLINE_EVENT = 'devmate:offline';
export const HEALTH_URL = `${BASE}/health`;

/** 응답을 기다리는 최대 시간. 끝없는 로딩을 막는다. AI 요청(쓰기)은 오래 걸릴 수 있어 넉넉하게. */
export const REQUEST_TIMEOUT_MS = { read: 60_000, write: 300_000 };

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(method === 'GET' ? REQUEST_TIMEOUT_MS.read : REQUEST_TIMEOUT_MS.write),
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') throw new ApiError(0, '서버 응답이 너무 늦어요. 잠시 후 다시 시도해 주세요.');
    window.dispatchEvent(new Event(OFFLINE_EVENT));
    throw new ApiError(0, 'DevMata AI 서버에 연결할 수 없어요. 다시 연결되면 다시 시도해 주세요.');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token && tokenStore.get() === token) {
      tokenStore.clear();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new ApiError(res.status, msg || `요청에 실패했습니다. (${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

/** 서버가 응답하는지 확인 (연결이 끊겼다가 돌아왔는지 볼 때) */
export async function serverAlive(url = HEALTH_URL): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');

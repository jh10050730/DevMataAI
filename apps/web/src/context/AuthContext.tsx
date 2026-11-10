import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore, UNAUTHORIZED_EVENT } from '../lib/api';
import type { User } from '../lib/types';
import { PERSISTENT_TOKEN_KEY } from '../lib/token-store';

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => !!tokenStore.get());

  // 저장된 토큰이 있으면 내 정보로 세션 복원
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) return;
    let active = true;
    api
      .get<User>('/users/me')
      .then(value => { if (active && tokenStore.get() === token) setUser(value); })
      .catch(() => { if (active && tokenStore.get() === token) tokenStore.clear(); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted && !tokenStore.isPersistent()) { tokenStore.clearSession(); setUser(null); }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !tokenStore.isPersistent()) { tokenStore.clearSession(); setUser(null); }
      else if (event.persisted && !tokenStore.get()) setUser(null);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === PERSISTENT_TOKEN_KEY || event.key === null) {
        // Account switches and explicit logout in another tab must discard stale UI.
        tokenStore.clearSession();
        window.location.reload();
      }
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('pagehide', onPageHide); window.removeEventListener('pageshow', onPageShow); window.removeEventListener('storage', onStorage); };
  }, []);

  // 어떤 요청이든 401 이 나면 로그아웃
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const handleAuth = (res: { accessToken: string; user: User }, remember = false) => {
    tokenStore.set(res.accessToken, remember);
    setUser(res.user);
  };

  const login = useCallback(async (email: string, password: string, remember = false) => {
    handleAuth(await api.post('/auth/login', { email, password }), remember);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    handleAuth(await api.post('/auth/register', { name, email, password }));
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

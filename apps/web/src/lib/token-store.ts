export const PERSISTENT_TOKEN_KEY = 'devmata-remembered-token';
const SESSION_TOKEN_KEY = 'devmata-session-token';
const LEGACY_TOKEN_KEY = 'devmate-token';
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Keep temporary logins within this tab; persistence requires an explicit opt-in. */
export function createTokenStore(local: StorageAccess, session: StorageAccess, navigationType: string) {
  const read = (storage: StorageAccess, key: string) => { try { return storage().getItem(key); } catch { return null; } };
  const remove = (storage: StorageAccess, key: string) => { try { storage().removeItem(key); } catch { /* Storage may be disabled. */ } };
  const write = (storage: StorageAccess, key: string, value: string) => { try { storage().setItem(key, value); return true; } catch { return false; } };
  remove(local, LEGACY_TOKEN_KEY);
  // A new visit, history return, or copied tab must not revive a temporary login.
  // Client-side routing does not recreate this store; only a real reload keeps it.
  if (navigationType !== 'reload') remove(session, SESSION_TOKEN_KEY);
  let mode: 'session' | 'persistent' | null = read(session, SESSION_TOKEN_KEY) ? 'session' : read(local, PERSISTENT_TOKEN_KEY) ? 'persistent' : null;
  let memoryFallback: string | null = null;
  return {
    get() {
      if (memoryFallback) return memoryFallback;
      return mode === 'session' ? read(session, SESSION_TOKEN_KEY) : mode === 'persistent' ? read(local, PERSISTENT_TOKEN_KEY) : null;
    },
    isPersistent() { return mode === 'persistent'; },
    /** 이 화면에서만 쓸 로그인 (저장소는 건드리지 않는다). 데스크톱 빠른 입력 창이 앱 창의 로그인을 넘겨받을 때 */
    adopt(token: string) { memoryFallback = token; },
    set(token: string, remember = false) {
      remove(local, PERSISTENT_TOKEN_KEY); remove(session, SESSION_TOKEN_KEY); remove(local, LEGACY_TOKEN_KEY);
      mode = remember ? 'persistent' : 'session'; memoryFallback = null;
      if (!write(remember ? local : session, remember ? PERSISTENT_TOKEN_KEY : SESSION_TOKEN_KEY, token)) {
        // If storage is unavailable, keep the login only in this page's memory.
        mode = 'session'; memoryFallback = token;
      }
    },
    clearSession() {
      remove(session, SESSION_TOKEN_KEY);
      if (mode === 'session') { mode = null; memoryFallback = null; }
    },
    clear() {
      mode = null; memoryFallback = null;
      remove(local, PERSISTENT_TOKEN_KEY); remove(session, SESSION_TOKEN_KEY); remove(local, LEGACY_TOKEN_KEY);
    },
  };
}

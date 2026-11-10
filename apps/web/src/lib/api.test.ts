import { afterEach, describe, expect, it, vi } from 'vitest';

describe('authentication response races', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  it('a delayed 401 from an old login cannot log out the new account', async () => {
    vi.stubGlobal('window', new EventTarget());
    let respond!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { respond = resolve; })));
    const { api, tokenStore } = await import('./api');
    tokenStore.set('old-account');
    const pending = api.get('/users/me');
    const rejected = expect(pending).rejects.toMatchObject({ status: 401 });
    tokenStore.set('new-account');
    respond(new Response(JSON.stringify({ message: 'expired' }), { status: 401 }));
    await rejected;
    expect(tokenStore.get()).toBe('new-account');
  });
  it('401 for the current token clears the login and notifies the UI', async () => {
    const target = new EventTarget(); const expired = vi.fn();
    target.addEventListener('devmate:unauthorized', expired);
    vi.stubGlobal('window', target);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    const { api, tokenStore } = await import('./api');
    tokenStore.set('expired-token');
    await expect(api.get('/users/me')).rejects.toMatchObject({ status: 401 });
    expect(tokenStore.get()).toBeNull(); expect(expired).toHaveBeenCalledOnce();
  });
});

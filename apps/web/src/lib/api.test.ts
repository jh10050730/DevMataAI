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

describe('server connection problems', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  it('a failed connection tells the banner and gives a user-facing message', async () => {
    const target = new EventTarget(); const offline = vi.fn();
    target.addEventListener('devmate:offline', offline);
    vi.stubGlobal('window', target);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { api } = await import('./api');
    await expect(api.get('/tasks')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('연결할 수 없어요') });
    expect(offline).toHaveBeenCalledOnce();
  });
  it('a slow server ends with a timeout message instead of loading forever', async () => {
    const target = new EventTarget(); const offline = vi.fn();
    target.addEventListener('devmate:offline', offline);
    vi.stubGlobal('window', target);
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    vi.stubGlobal('fetch', fetchMock);
    const { api, REQUEST_TIMEOUT_MS } = await import('./api');
    await expect(api.post('/assistant/chat', {})).rejects.toMatchObject({ status: 0, message: expect.stringContaining('너무 늦어요') });
    expect(offline).not.toHaveBeenCalled(); // 느린 것은 끊긴 것이 아니다
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(REQUEST_TIMEOUT_MS.write).toBeGreaterThanOrEqual(REQUEST_TIMEOUT_MS.read);
  });
  it('health check reports whether the server answers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 200 })).mockRejectedValueOnce(new TypeError('down')));
    const { serverAlive } = await import('./api');
    expect(await serverAlive()).toBe(true);
    expect(await serverAlive()).toBe(false);
  });
});

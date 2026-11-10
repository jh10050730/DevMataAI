import { describe, expect, it } from 'vitest';
import { createTokenStore, PERSISTENT_TOKEN_KEY } from './token-store';

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
describe('login persistence choices', () => {
  it('unchecked login stays in this tab and survives a refresh', () => {
    const local = memoryStorage(), session = memoryStorage();
    const store = createTokenStore(() => local, () => session, 'navigate');
    store.set('temporary');
    expect(local.getItem(PERSISTENT_TOKEN_KEY)).toBeNull();
    expect(store.isPersistent()).toBe(false);
    expect(createTokenStore(() => local, () => session, 'reload').get()).toBe('temporary');
    expect(createTokenStore(() => local, () => memoryStorage(), 'navigate').get()).toBeNull();
  });
  it.each(['navigate', 'back_forward', 'unknown'])('returning via %s does not restore temporary login', navigation => {
    const local = memoryStorage(), session = memoryStorage();
    createTokenStore(() => local, () => session, 'navigate').set('temporary');
    expect(createTokenStore(() => local, () => session, navigation).get()).toBeNull();
    expect(createTokenStore(() => local, () => session, 'reload').get()).toBeNull();
  });
  it('checked login survives closing the tab and opening a new one', () => {
    const local = memoryStorage();
    const store = createTokenStore(() => local, () => memoryStorage(), 'navigate');
    store.set('remembered', true);
    const next = createTokenStore(() => local, () => memoryStorage(), 'navigate');
    expect(next.get()).toBe('remembered'); expect(next.isPersistent()).toBe(true);
  });
  it('switching to unchecked login removes the previous persistent account', () => {
    const local = memoryStorage(), session = memoryStorage();
    const store = createTokenStore(() => local, () => session, 'navigate');
    store.set('account-a', true); store.set('account-b', false);
    expect(store.get()).toBe('account-b');
    expect(createTokenStore(() => local, () => memoryStorage(), 'navigate').get()).toBeNull();
  });
  it('switching to remembered login removes the previous temporary account', () => {
    const local = memoryStorage(), session = memoryStorage();
    const store = createTokenStore(() => local, () => session, 'navigate');
    store.set('temporary'); store.set('remembered', true);
    expect(createTokenStore(() => local, () => session, 'reload').get()).toBe('remembered');
  });
  it('logout clears both kinds of tokens', () => {
    const local = memoryStorage(), session = memoryStorage();
    const store = createTokenStore(() => local, () => session, 'navigate');
    store.set('remembered', true); store.clear();
    expect(store.get()).toBeNull();
    expect(createTokenStore(() => local, () => session, 'reload').get()).toBeNull();
    store.set('temporary'); store.clear();
    expect(createTokenStore(() => local, () => session, 'reload').get()).toBeNull();
  });
  it('returning to a cached document can discard a temporary session', () => {
    const local = memoryStorage(), session = memoryStorage();
    const store = createTokenStore(() => local, () => session, 'navigate');
    store.set('temporary'); store.clearSession();
    expect(store.get()).toBeNull();
    expect(createTokenStore(() => local, () => session, 'reload').get()).toBeNull();
  });
  it('legacy automatic login is not silently treated as consent', () => {
    const local = memoryStorage(); local.setItem('devmate-token', 'old-token');
    expect(createTokenStore(() => local, () => memoryStorage(), 'navigate').get()).toBeNull();
    expect(local.getItem('devmate-token')).toBeNull();
  });
  it('blocked storage falls back to memory, never to automatic login', () => {
    const unavailable = () => { throw new Error('blocked'); };
    const store = createTokenStore(unavailable, unavailable, 'navigate');
    store.set('current-page-only', true);
    expect(store.get()).toBe('current-page-only'); expect(store.isPersistent()).toBe(false);
    expect(createTokenStore(unavailable, unavailable, 'reload').get()).toBeNull();
    store.clear(); expect(store.get()).toBeNull();
  });
});

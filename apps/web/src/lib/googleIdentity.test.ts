import { describe, expect, it, vi } from 'vitest';
import { POLL_MS, verifyWithGoogle, WAIT_MS, type IdentityResult } from './googleIdentity';

const done: IdentityResult = { status: 'done', purpose: 'find', email: 'me@gmail.com', name: '나', exists: true };

function setup(results: IdentityResult[]) {
  let clock = 0;
  const open = vi.fn();
  const start = vi.fn(async () => ({ url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1', requestId: 'req-1' }));
  const result = vi.fn(async () => results.shift() ?? { status: 'pending' as const });
  const sleep = vi.fn(async (ms: number) => { clock += ms; });
  return { open, start, result, sleep, now: () => clock };
}

describe('verifyWithGoogle', () => {
  it('Google 주소를 열고 끝날 때까지 기다린다', async () => {
    const o = setup([{ status: 'pending' }, { status: 'pending' }, done]);
    await expect(verifyWithGoogle('find', o)).resolves.toEqual(done);
    expect(o.start).toHaveBeenCalledWith('find');
    expect(o.open).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1');
    expect(o.result).toHaveBeenCalledTimes(3);
    expect(o.result).toHaveBeenCalledWith('req-1');
    expect(o.sleep).toHaveBeenCalledWith(POLL_MS);
  });

  it('오류 결과는 그 메시지로 던진다', async () => {
    const o = setup([{ status: 'error', message: 'Google 확인을 취소했어요.' }]);
    await expect(verifyWithGoogle('reset', o)).rejects.toThrow('Google 확인을 취소했어요.');
  });

  it('취소하면 더 묻지 않는다', async () => {
    const controller = new AbortController();
    const o = setup([]);
    o.sleep.mockImplementation(async () => { controller.abort(); });
    await expect(verifyWithGoogle('signup', { ...o, signal: controller.signal })).rejects.toThrow('취소');
    expect(o.result).not.toHaveBeenCalled();
  });

  it('10분이 지나면 시간 초과', async () => {
    const o = setup([]);
    await expect(verifyWithGoogle('find', o)).rejects.toThrow('시간이 지났어요');
    expect(o.result.mock.calls.length).toBe(Math.ceil(WAIT_MS / POLL_MS));
  });
});

import { decryptToken, encryptToken, pkceChallenge, pkceVerifier, signState, verifyState } from './google-crypto';
import { mapGoogleEvent } from './google-calendar.service';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';

describe('google-crypto', () => {
  it('토큰 암호화 → 복호화, 평문이 저장값에 드러나지 않음', () => {
    const enc = encryptToken('ya29.secret-token', SECRET);
    expect(enc).not.toContain('ya29');
    expect(decryptToken(enc, SECRET)).toBe('ya29.secret-token');
    expect(encryptToken('ya29.secret-token', SECRET)).not.toBe(enc); // IV 무작위
  });

  it('다른 키나 변조된 값은 복호화 실패', () => {
    const enc = encryptToken('abc', SECRET);
    expect(() => decryptToken(enc, SECRET + 'x')).toThrow();
    const parts = enc.split('.');
    parts[3] = Buffer.from('xyz').toString('base64url');
    expect(() => decryptToken(parts.join('.'), SECRET)).toThrow();
  });

  it('state: 서명 검증, 만료, 변조 거부', () => {
    const now = 1_000_000;
    const state = signState('user-1', SECRET, 60_000, now);
    expect(verifyState(state, SECRET, now + 1000)).toBe('user-1');
    expect(verifyState(state, SECRET, now + 61_000)).toBeNull();
    expect(verifyState(state, SECRET + 'x', now)).toBeNull();
    const [body, sig] = state.split('.');
    const forged = Buffer.from(JSON.stringify({ u: 'user-2', e: now + 60_000, n: 'x' })).toString('base64url');
    expect(verifyState(`${forged}.${sig}`, SECRET, now)).toBeNull();
    expect(verifyState(body, SECRET, now)).toBeNull();
    expect(verifyState('garbage', SECRET, now)).toBeNull();
  });

  it('PKCE: 로그인마다 다른 43자 열쇠, 같은 state 면 콜백에서 같은 값, RFC 7636 예시와 일치', () => {
    const a = signState('user-1', SECRET);
    const b = signState('user-1', SECRET);
    const verifier = pkceVerifier(a, SECRET);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pkceVerifier(a, SECRET)).toBe(verifier); // 콜백에서 다시 계산
    expect(pkceVerifier(b, SECRET)).not.toBe(verifier); // state 난수가 달라 열쇠도 다름
    expect(pkceVerifier(a, SECRET + 'x')).not.toBe(verifier);
    // RFC 7636 부록 B
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('mapGoogleEvent', () => {
  it('시간 일정', () => {
    const e = mapGoogleEvent({
      id: 'a',
      summary: ' 회의 ',
      location: '회의실',
      start: { dateTime: '2026-11-10T10:00:00+09:00' },
      end: { dateTime: '2026-11-10T11:00:00+09:00' },
    })!;
    expect(e).toMatchObject({ title: '회의', location: '회의실', allDay: false });
    expect(e.startAt.toISOString()).toBe('2026-11-10T01:00:00.000Z');
    expect(e.endAt.toISOString()).toBe('2026-11-10T02:00:00.000Z');
  });

  it('종일 일정: 로컬 자정 ~ 다음 날 자정 (앱의 종일 일정과 같은 형식)', () => {
    const e = mapGoogleEvent({ id: 'b', start: { date: '2026-11-10' }, end: { date: '2026-11-11' } })!;
    expect(e.allDay).toBe(true);
    expect(e.title).toBe('(제목 없음)');
    expect(e.startAt).toEqual(new Date(2026, 10, 10));
    expect(e.endAt).toEqual(new Date(2026, 10, 11));
  });

  it('시작이 없으면 null, 긴 제목은 200자로 자름', () => {
    expect(mapGoogleEvent({ id: 'c' })).toBeNull();
    const e = mapGoogleEvent({ id: 'd', summary: 'x'.repeat(300), start: { dateTime: '2026-11-10T10:00:00Z' } })!;
    expect(e.title).toHaveLength(200);
    expect(e.endAt).toEqual(e.startAt);
  });
});

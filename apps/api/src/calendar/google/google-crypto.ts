import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * 외부 서비스 토큰 암호화(AES-256-GCM)와 OAuth state 서명(HMAC-SHA256).
 * 키는 JWT_SECRET 에서 파생한다. JWT_SECRET 을 바꾸면 저장된 토큰을 읽을 수 없으므로 다시 연결해야 한다.
 */
const key = (secret: string, purpose: string) => createHash('sha256').update(`${purpose}:${secret}`).digest();

export function encryptToken(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret, 'integration-token'), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decryptToken(value: string, secret: string): string {
  const [v, iv, tag, data] = value.split('.');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('알 수 없는 토큰 형식');
  const decipher = createDecipheriv('aes-256-gcm', key(secret, 'integration-token'), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/** OAuth state: 사용자 ID + 만료시각을 서명해 콜백에서 위조·재사용 시간을 막는다. */
export function signState(userId: string, secret: string, ttlMs = 10 * 60_000, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ u: userId, e: now + ttlMs, n: randomBytes(8).toString('hex') })).toString('base64url');
  const sig = createHmac('sha256', key(secret, 'oauth-state')).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/**
 * PKCE(RFC 7636): 로그인마다 다른 일회용 열쇠. state(매번 다른 난수 포함)와 서버 비밀값으로 계산하므로 저장할 필요가 없다.
 * 데스크톱 앱 클라이언트는 비밀번호를 숨길 수 없어서, 가로챈 인증 코드를 쓰지 못하게 막는 역할을 한다.
 */
export function pkceVerifier(state: string, secret: string): string {
  return createHmac('sha256', key(secret, 'oauth-pkce')).update(state).digest('base64url'); // 43자
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function verifyState(state: string, secret: string, now = Date.now()): string | null {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', key(secret, 'oauth-state')).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { u?: unknown; e?: unknown };
    if (typeof u !== 'string' || typeof e !== 'number' || e < now) return null;
    return u;
  } catch {
    return null;
  }
}

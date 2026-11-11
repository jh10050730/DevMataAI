import { BadRequestException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { isDesktop } from '../common/desktop';
import { pkceChallenge, pkceVerifier, signState, verifyState } from '../calendar/google/google-crypto';

/**
 * Google 계정으로 본인(이메일) 확인: 회원가입·비밀번호 찾기·아이디 찾기.
 *
 * 로그인하지 않은 상태에서 쓰므로 흐름은 이렇다.
 *  1) 화면이 start(purpose) → Google 로그인 주소와 requestId(추측 불가 난수)를 받아 브라우저로 연다.
 *  2) Google 이 캘린더와 같은 콜백(/api/google/callback)으로 돌아온다. state 가 "identity:" 로 시작하면 여기서 처리한다.
 *  3) 화면은 result(requestId) 를 잠깐마다 물어 결과를 받는다 (한 번 받으면 지워진다).
 *
 * 이메일·이름·프로필만 요청한다 (캘린더 권한 없음). 토큰은 저장하지 않는다.
 */
export type IdentityPurpose = 'signup' | 'reset' | 'find';
export const IDENTITY_PURPOSES: IdentityPurpose[] = ['signup', 'reset', 'find'];

export type IdentityResult =
  | { status: 'pending' }
  | { status: 'error'; message: string }
  | { status: 'done'; purpose: IdentityPurpose; email: string; name: string; exists: boolean; ticket?: string; resetPath?: string };

const SCOPES = ['openid', 'email', 'profile'];
const PREFIX = 'identity:';
const REQUEST_TTL = 10 * 60_000;
const TICKET_TTL = 15 * 60_000;
const MAX_PENDING = 200;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

interface Pending { purpose: IdentityPurpose; expires: number; result?: IdentityResult }
interface Ticket { email: string; name: string; expires: number }
interface IdTokenPayload { aud?: string; iss?: string; exp?: number; email?: string; email_verified?: boolean | string; name?: string }

/** 토큰 엔드포인트에서 TLS 로 직접 받은 id_token 의 내용 (OIDC Core 3.1.3.7: 직접 받은 토큰은 서명 검증 생략 가능, 대신 aud·iss·exp 확인) */
export function readIdToken(idToken: string | undefined, clientId: string, now = Date.now()): { email: string; name: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split('.')[1], 'base64url').toString('utf8')) as IdTokenPayload;
    if (payload.aud !== clientId) return null;
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss ?? '')) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < now) return null;
    if (payload.email_verified !== true && payload.email_verified !== 'true') return null;
    if (typeof payload.email !== 'string' || !payload.email.includes('@')) return null;
    return { email: payload.email.trim().toLowerCase().slice(0, 254), name: (payload.name ?? '').trim().slice(0, 50) };
  } catch {
    return null;
  }
}

@Injectable()
export class GoogleIdentityService {
  private readonly log = new Logger('GoogleIdentity');
  private pending = new Map<string, Pending>();
  private tickets = new Map<string, Ticket>();

  constructor(private readonly db: PrismaService, private readonly config: ConfigService) {}

  private get clientId() { return this.config.get<string>('GOOGLE_CLIENT_ID') || ''; }
  private get clientSecret() { return this.config.get<string>('GOOGLE_CLIENT_SECRET') || ''; }
  private get secret() { return this.config.get<string>('JWT_SECRET') || ''; }
  private get redirectUri() {
    return this.config.get<string>('GOOGLE_REDIRECT_URI') || `http://localhost:${this.config.get('PORT', 3000)}/api/google/callback`;
  }

  /** Google 키가 있으면 본인 확인을 쓸 수 있다 */
  get available() { return !!(this.clientId && this.clientSecret); }

  /** 회원가입에 Google 확인이 꼭 필요한지: 데스크톱 앱이고 Google 키가 있을 때 (개발 서버·테스트는 예전처럼) */
  get requiredForSignup() { return this.available && isDesktop(); }

  private prune(now = Date.now()) {
    for (const [id, p] of this.pending) if (p.expires <= now) this.pending.delete(id);
    for (const [id, t] of this.tickets) if (t.expires <= now) this.tickets.delete(id);
  }

  start(purpose: IdentityPurpose) {
    if (!this.available) throw new BadRequestException('이 앱에는 Google 연동 키가 없어 Google 확인을 쓸 수 없어요.');
    this.prune();
    if (this.pending.size >= MAX_PENDING) throw new HttpException('요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', 429);
    const requestId = randomBytes(24).toString('base64url');
    const state = signState(PREFIX + requestId, this.secret, REQUEST_TTL);
    this.pending.set(requestId, { purpose, expires: Date.now() + REQUEST_TTL });
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      prompt: 'select_account',
      state,
      code_challenge: pkceChallenge(pkceVerifier(state, this.secret)),
      code_challenge_method: 'S256',
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, requestId };
  }

  /** 이 콜백이 본인 확인용인지 (state 가 서명된 identity: 요청) */
  owns(state: string | undefined): boolean {
    return !!state && (verifyState(state, this.secret)?.startsWith(PREFIX) ?? false);
  }

  /** Google 콜백 처리. 결과는 화면이 result() 로 가져간다. 브라우저 안내용 { ok, message } 를 돌려준다 */
  async callback(code: string | undefined, state: string | undefined, error: string | undefined): Promise<{ ok: boolean; message: string }> {
    const subject = state ? verifyState(state, this.secret) : null;
    const requestId = subject?.startsWith(PREFIX) ? subject.slice(PREFIX.length) : null;
    const pending = requestId ? this.pending.get(requestId) : undefined;
    if (!pending || pending.expires <= Date.now()) return { ok: false, message: '확인 요청이 만료됐어요. 앱에서 다시 시도해 주세요.' };
    const fail = (message: string) => { pending.result = { status: 'error', message }; return { ok: false, message }; };
    if (error) return fail(error === 'access_denied' ? 'Google 확인을 취소했어요.' : `Google 오류: ${error.slice(0, 100)}`);
    if (!code) return fail('Google 에서 인증 코드를 받지 못했어요.');

    let idToken: string | undefined;
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: pkceVerifier(state!, this.secret),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
      if (!res.ok) { this.log.warn(`token 요청 실패: ${res.status} ${json.error ?? ''}`); return fail('Google 확인에 실패했어요. 다시 시도해 주세요.'); }
      idToken = json.id_token;
    } catch {
      return fail('Google 서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.');
    }
    const who = readIdToken(idToken, this.clientId);
    if (!who) return fail('Google 에서 확인된 이메일을 받지 못했어요.');

    const user = await this.db.user.findUnique({ where: { email: who.email }, select: { id: true } });
    const done: Extract<IdentityResult, { status: 'done' }> = { status: 'done', purpose: pending.purpose, email: who.email, name: who.name, exists: !!user };
    if (pending.purpose === 'signup' && !user) {
      const ticket = randomBytes(32).toString('base64url');
      this.tickets.set(hash(ticket), { email: who.email, name: who.name, expires: Date.now() + TICKET_TTL });
      done.ticket = ticket;
    }
    if (pending.purpose === 'reset' && user) {
      // 기존 비밀번호 재설정 화면을 그대로 쓴다 (15분, 한 번만)
      const token = randomBytes(32).toString('hex');
      await this.db.user.update({ where: { id: user.id }, data: { resetTokenHash: hash(token), resetTokenExpiresAt: new Date(Date.now() + 15 * 60_000) } });
      done.resetPath = `/reset-password#token=${token}`;
    }
    pending.result = done;
    return { ok: true, message: `${who.email} 확인을 마쳤어요.` };
  }

  /** 화면이 결과를 묻는다. 끝난 결과는 한 번만 돌려주고 지운다 */
  result(requestId: string): IdentityResult {
    const pending = this.pending.get(requestId);
    if (!pending || pending.expires <= Date.now()) throw new NotFoundException('확인 요청이 만료됐어요. 다시 시도해 주세요.');
    if (!pending.result) return { status: 'pending' };
    this.pending.delete(requestId);
    return pending.result;
  }

  /** 회원가입 때 확인 표를 쓴다 (한 번만). 확인된 이메일·이름 */
  consumeTicket(ticket: string | undefined): { email: string; name: string } {
    this.prune();
    const key = ticket ? hash(ticket) : '';
    const found = ticket ? this.tickets.get(key) : undefined;
    if (!found) throw new BadRequestException('Google 확인이 만료됐거나 이미 사용됐어요. 다시 확인해 주세요.');
    this.tickets.delete(key);
    return { email: found.email, name: found.name };
  }
}

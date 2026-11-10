import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptToken, encryptToken, signState, verifyState } from './google-crypto';

const PROVIDER = 'GOOGLE_CALENDAR';
const SOURCE = 'GOOGLE';
/** 읽기 전용 권한만 요청한다. DevMata AI는 Google 일정을 만들거나 수정·삭제하지 않는다. */
export const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly'];
const DAY = 86_400_000;
const SYNC_PAST_DAYS = 30;
const SYNC_FUTURE_DAYS = 180;
const MAX_PAGES = 10; // 최대 2,500개

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleEventItem {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

interface Meta {
  email?: string;
  lastSyncAt?: string;
}

/** 'YYYY-MM-DD' (Google 종일 일정) → 서버 로컬 자정. 앱의 종일 일정과 같이 end 는 다음 날 자정(배타적). */
function localDate(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Google 일정 → 로컬 Event 필드. 시작/끝이 없거나 잘못된 항목은 null. */
export function mapGoogleEvent(item: GoogleEventItem) {
  const allDay = !!item.start?.date;
  const start = item.start?.dateTime ? new Date(item.start.dateTime) : item.start?.date ? localDate(item.start.date) : null;
  const endRaw = item.end?.dateTime ? new Date(item.end.dateTime) : item.end?.date ? localDate(item.end.date) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const end = endRaw && !Number.isNaN(endRaw.getTime()) && endRaw >= start ? endRaw : allDay ? new Date(start.getTime() + DAY) : start;
  return {
    title: (item.summary?.trim() || '(제목 없음)').slice(0, 200),
    description: item.description ? item.description.slice(0, 10_000) : null,
    location: item.location ? item.location.slice(0, 200) : null,
    startAt: start,
    endAt: end,
    allDay,
  };
}

@Injectable()
export class GoogleCalendarService {
  private readonly log = new Logger('GoogleCalendar');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get clientId() {
    return this.config.get<string>('GOOGLE_CLIENT_ID') || '';
  }
  private get clientSecret() {
    return this.config.get<string>('GOOGLE_CLIENT_SECRET') || '';
  }
  private get secret() {
    return this.config.get<string>('JWT_SECRET') || '';
  }
  get redirectUri() {
    return this.config.get<string>('GOOGLE_REDIRECT_URI') || `http://localhost:${this.config.get('PORT', 3000)}/api/google/callback`;
  }
  get webOrigin() {
    return this.config.get<string>('WEB_ORIGIN', 'http://localhost:5173');
  }
  get configured() {
    return !!(this.clientId && this.clientSecret);
  }

  private assertConfigured() {
    if (!this.configured) {
      throw new BadRequestException('Google Calendar 가 설정되지 않았습니다. apps/api/.env 에 GOOGLE_CLIENT_ID 와 GOOGLE_CLIENT_SECRET 을 설정해주세요.');
    }
  }

  private integration(userId: string) {
    return this.prisma.integration.findUnique({ where: { userId_provider: { userId, provider: PROVIDER } } });
  }

  private meta(raw: string | null | undefined): Meta {
    try {
      return raw ? (JSON.parse(raw) as Meta) : {};
    } catch {
      return {};
    }
  }

  async status(userId: string) {
    const [row, count] = await Promise.all([
      this.integration(userId),
      this.prisma.event.count({ where: { userId, source: SOURCE } }),
    ]);
    const meta = this.meta(row?.metadata);
    return {
      configured: this.configured,
      connected: row?.status === 'CONNECTED',
      needsReconnect: row?.status === 'ERROR',
      email: meta.email ?? null,
      lastSyncAt: meta.lastSyncAt ?? null,
      syncedEvents: count,
      readOnly: true,
      redirectUri: this.redirectUri,
    };
  }

  /** Google 로그인 화면 주소 (state 에 사용자 ID 를 서명해 담는다) */
  authUrl(userId: string) {
    this.assertConfigured();
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline', // refresh token 발급
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: signState(userId, this.secret),
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  }

  /** OAuth 콜백: 코드 → 토큰 교환 후 암호화 저장. 성공 시 사용자 ID 반환 */
  async handleCallback(code: string | undefined, state: string | undefined) {
    this.assertConfigured();
    const userId = state ? verifyState(state, this.secret) : null;
    if (!userId) throw new BadRequestException('연결 요청이 만료되었거나 올바르지 않습니다. 다시 시도해주세요.');
    if (!code) throw new BadRequestException('Google 에서 인증 코드를 받지 못했습니다.');
    if (!(await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
      throw new BadRequestException('사용자를 찾을 수 없습니다.');
    }

    const token = await this.tokenRequest({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });
    if (!token.scope?.includes('calendar.readonly')) {
      throw new BadRequestException('캘린더 읽기 권한이 허용되지 않았습니다. 연결할 때 권한을 체크해주세요.');
    }

    const existing = await this.integration(userId);
    const meta = { ...this.meta(existing?.metadata), email: emailFromIdToken(token.id_token) };
    const refreshToken = token.refresh_token
      ? encryptToken(token.refresh_token, this.secret)
      : existing?.refreshToken ?? null;
    const data = {
      status: 'CONNECTED',
      accessToken: encryptToken(token.access_token, this.secret),
      refreshToken,
      scope: token.scope ?? null,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      metadata: JSON.stringify(meta),
    };
    await this.prisma.integration.upsert({
      where: { userId_provider: { userId, provider: PROVIDER } },
      create: { ...data, userId, provider: PROVIDER },
      update: data,
    });
    return userId;
  }

  /** 유효한 access token (만료 1분 전이면 갱신) */
  private async accessToken(userId: string) {
    this.assertConfigured();
    const row = await this.integration(userId);
    if (!row || !row.accessToken || row.status === 'DISCONNECTED') {
      throw new BadRequestException('Google Calendar 가 연결되지 않았습니다. 설정 화면에서 연결해주세요.');
    }
    if (row.expiresAt && row.expiresAt.getTime() - 60_000 > Date.now()) {
      return decryptToken(row.accessToken, this.secret);
    }
    if (!row.refreshToken) return this.markError(userId);
    try {
      const token = await this.tokenRequest({
        refresh_token: decryptToken(row.refreshToken, this.secret),
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
      });
      await this.prisma.integration.update({
        where: { id: row.id },
        data: {
          status: 'CONNECTED',
          accessToken: encryptToken(token.access_token, this.secret),
          expiresAt: new Date(Date.now() + token.expires_in * 1000),
        },
      });
      return token.access_token;
    } catch (e) {
      if (e instanceof BadRequestException) return this.markError(userId);
      throw e;
    }
  }

  private async markError(userId: string): Promise<never> {
    await this.prisma.integration.update({
      where: { userId_provider: { userId, provider: PROVIDER } },
      data: { status: 'ERROR' },
    });
    throw new BadRequestException('Google 연결이 만료되었거나 해제되었습니다. 설정 화면에서 다시 연결해주세요.');
  }

  private async tokenRequest(body: Record<string, string>): Promise<GoogleTokenResponse> {
    let res: Response;
    try {
      res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadRequestException('Google 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
    }
    const json = (await res.json().catch(() => ({}))) as GoogleTokenResponse;
    if (!res.ok || !json.access_token) {
      this.log.warn(`token 요청 실패: ${res.status} ${json.error ?? ''}`); // 토큰·코드 값은 기록하지 않음
      throw new BadRequestException(
        json.error === 'invalid_grant'
          ? 'Google 인증이 만료되었습니다. 다시 연결해주세요.'
          : json.error === 'redirect_uri_mismatch'
            ? `Google Cloud 콘솔의 승인된 리디렉션 URI 에 ${this.redirectUri} 를 추가해주세요.`
            : `Google 인증에 실패했습니다 (${json.error ?? res.status}).`,
      );
    }
    return json;
  }

  /**
   * 기본 캘린더 → DevMata AI 일정 (읽기 전용 단방향).
   * 최근 30일 ~ 앞으로 180일. Google 에서 삭제된 일정은 DevMata AI의 사본만 지운다. Google 쪽 데이터는 바꾸지 않는다.
   */
  async sync(userId: string) {
    const token = await this.accessToken(userId);
    const now = Date.now();
    const timeMin = new Date(now - SYNC_PAST_DAYS * DAY);
    const timeMax = new Date(now + SYNC_FUTURE_DAYS * DAY);

    const items: GoogleEventItem[] = [];
    let pageToken: string | undefined;
    let complete = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
        ...(pageToken ? { pageToken } : {}),
      });
      const body = await this.calendarGet(userId, token, `/calendars/primary/events?${params}`);
      items.push(...((body.items as GoogleEventItem[]) ?? []));
      pageToken = body.nextPageToken as string | undefined;
      if (!pageToken) {
        complete = true;
        break;
      }
    }

    let created = 0;
    let updated = 0;
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.id || item.status === 'cancelled') continue;
      const data = mapGoogleEvent(item);
      if (!data) continue;
      seen.add(item.id);
      const key = { userId_source_externalId: { userId, source: SOURCE, externalId: item.id } };
      const existed = await this.prisma.event.findUnique({ where: key, select: { id: true } });
      await this.prisma.event.upsert({
        where: key,
        create: { ...data, userId, source: SOURCE, externalId: item.id, category: 'GENERAL' },
        update: data,
      });
      if (existed) updated++;
      else created++;
    }

    // 전체 목록을 받은 경우에만, 기간 안에서 Google 에 더 이상 없는 사본을 정리
    let removed = 0;
    if (complete) {
      const res = await this.prisma.event.deleteMany({
        where: {
          userId,
          source: SOURCE,
          startAt: { lt: timeMax },
          endAt: { gt: timeMin },
          externalId: { notIn: [...seen] },
        },
      });
      removed = res.count;
    }

    const row = await this.integration(userId);
    await this.prisma.integration.update({
      where: { userId_provider: { userId, provider: PROVIDER } },
      data: { metadata: JSON.stringify({ ...this.meta(row?.metadata), lastSyncAt: new Date().toISOString() }) },
    });
    return { created, updated, removed, total: seen.size, complete, range: { from: timeMin, to: timeMax } };
  }

  private async calendarGet(userId: string, token: string, path: string): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BadRequestException('Google Calendar 에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
    }
    if (res.status === 401) return this.markError(userId);
    if (!res.ok) {
      this.log.warn(`calendar 요청 실패: ${res.status}`);
      throw new BadRequestException(
        res.status === 403
          ? 'Google Calendar API 가 꺼져 있거나 권한이 없습니다. Google Cloud 콘솔에서 Calendar API 를 사용 설정해주세요.'
          : `Google Calendar 요청에 실패했습니다 (${res.status}).`,
      );
    }
    return (await res.json()) as Record<string, unknown>;
  }

  /**
   * 연결 해제: 저장된 토큰을 지우고 Google 에 권한 철회를 요청한다.
   * removeEvents=true 면 DevMata AI에 가져온 사본 일정도 지운다 (Google 의 원본은 그대로).
   */
  async disconnect(userId: string, removeEvents: boolean) {
    const row = await this.integration(userId);
    let revoked = false;
    if (row?.refreshToken || row?.accessToken) {
      try {
        const token = decryptToken((row.refreshToken ?? row.accessToken)!, this.secret);
        const res = await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }),
          signal: AbortSignal.timeout(10_000),
        });
        revoked = res.ok;
      } catch {
        revoked = false; // 네트워크 실패여도 로컬 토큰은 지운다
      }
    }
    if (row) await this.prisma.integration.delete({ where: { id: row.id } });
    const removed = removeEvents ? (await this.prisma.event.deleteMany({ where: { userId, source: SOURCE } })).count : 0;
    return { disconnected: !!row, revoked, removedEvents: removed };
  }
}

/** Google 이 TLS 로 직접 돌려준 id_token 에서 표시용 이메일만 읽는다 (인증 용도로 쓰지 않음). */
function emailFromIdToken(idToken?: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split('.')[1], 'base64url').toString('utf8')) as { email?: string };
    return typeof payload.email === 'string' ? payload.email.slice(0, 254) : undefined;
  } catch {
    return undefined;
  }
}

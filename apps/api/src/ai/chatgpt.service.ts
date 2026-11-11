import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { databaseFile } from '../prisma/database-url';
import { PrismaService } from '../prisma/prisma.service';
import { AiError, AiRequest, AiResult } from './ai.types';
import { CodexClient, executeCodex } from './codex-client';

type Session = { client: CodexClient; loginId?: string; timer: ReturnType<typeof setTimeout> };
@Injectable()
export class ChatGptService implements OnModuleDestroy {
  private sessions = new Map<string, Session>();
  private opening = new Map<string, Promise<Session>>();
  private mutations = new Set<string>();
  private clients = new Set<CodexClient>();
  private destroyed = false;
  constructor(private readonly db: PrismaService, private readonly config: ConfigService) {}
  onModuleDestroy() { this.destroyed = true; for (const client of this.clients) client.close(); this.clients.clear(); for (const id of this.sessions.keys()) this.close(id); }
  private path() {
    const configured = this.config.get<string>('CODEX_CLI_PATH');
    if (configured) {
      if (/\.(cmd|bat|ps1)$/i.test(configured)) throw new AiError('ChatGPT 연결 실행 경로에는 셸 명령 대신 실제 실행 파일 경로를 지정해 주세요.', 400);
      return configured;
    }
    const candidates = [join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'), join(homedir(), '.local', 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex')];
    return candidates.find(path => existsSync(path)) || 'codex';
  }
  private home(userId: string) { return join(dirname(databaseFile(this.config.getOrThrow<string>('DATABASE_URL'))), 'codex-accounts', createHash('sha256').update(userId).digest('hex')); }
  private close(userId: string) { const session = this.sessions.get(userId); if (session) { clearTimeout(session.timer); session.client.close(); this.clients.delete(session.client); this.sessions.delete(userId); } }
  private async session(userId: string): Promise<Session> {
    if (this.destroyed) throw new AiError('앱이 종료 중입니다.', 503);
    const existing = this.sessions.get(userId); if (existing) return existing;
    if (!this.opening.has(userId)) this.opening.set(userId, (async () => {
      const home = this.home(userId); await mkdir(home, { recursive: true });
      const work = join(home, 'work'); await mkdir(work, { recursive: true });
      if (this.destroyed) throw new AiError('앱이 종료 중입니다.', 503);
      const client = new CodexClient(this.path(), home, work);
      this.clients.add(client);
      try { await client.initialize(); if (this.destroyed) throw new AiError('앱이 종료 중입니다.', 503); } catch (e) { client.close(); this.clients.delete(client); throw e; }
      const timer = setTimeout(() => this.close(userId), 10 * 60000); timer.unref();
      const session = { client, timer }; this.sessions.set(userId, session); return session;
    })().finally(() => this.opening.delete(userId)));
    return this.opening.get(userId)!;
  }
  private row(userId: string) { return this.db.integration.findUnique({ where: { userId_provider: { userId, provider: 'CHATGPT' } } }); }
  private model(metadata?: string | null): string | undefined { try { return JSON.parse(metadata || '{}').model; } catch { return undefined; } }
  private async account(userId: string) {
    const session = await this.session(userId);
    const result = await session.client.request('account/read', { refreshToken: false });
    if (session.client.loginFinished) session.loginId = undefined;
    return result.account?.type === 'chatgpt' ? result.account : null;
  }
  async status(userId: string) {
    const row = await this.row(userId); const model = this.model(row?.metadata);
    try {
      const account = await this.account(userId);
      let selectedModel = model;
      if (account && !selectedModel) { try { selectedModel = await this.defaultModel(userId); } catch { /* Login stays connected; a failed model lookup can be retried on the next request. */ } }
      return { enabled: true, connected: !!account, email: account?.email, plan: account?.planType, model: selectedModel, pending: !!this.sessions.get(userId)?.loginId, message: account ? '본인 ChatGPT 계정으로 연결되었습니다. 기본 모델을 자동으로 사용합니다.' : 'ChatGPT로 로그인해 연결하세요. 로그인은 이 앱 계정별로 저장됩니다.' };
    } catch (e) {
      this.close(userId);
      return { enabled: false, connected: false, model, pending: false, message: e instanceof AiError ? e.message : 'ChatGPT 연결 프로그램을 찾지 못했습니다. 설치 안내를 확인하고 앱을 다시 시작해 주세요.' };
    }
  }
  private async mutate<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    if (this.mutations.has(userId)) throw new BadRequestException('계정 연결 작업 중입니다. 잠시 후 다시 시도해 주세요.');
    this.mutations.add(userId); try { return await fn(); } finally { this.mutations.delete(userId); }
  }
  async start(userId: string) { return this.mutate(userId, async () => {
    const session = await this.session(userId);
    if (session.loginId) throw new BadRequestException('이미 로그인 중입니다. 완료하거나 취소해 주세요.');
    session.client.loginFinished = false;
    const result = await session.client.request('account/login/start', { type: 'chatgpt' });
    const url = new URL(result.authUrl);
    if (!['https://auth.openai.com', 'https://chatgpt.com'].includes(url.origin) || !result.loginId) { this.close(userId); throw new AiError('공식 로그인 주소를 확인하지 못했습니다.'); }
    session.loginId = result.loginId; return { url: url.href };
  }); }
  async cancel(userId: string) { return this.mutate(userId, async () => {
    const session = this.sessions.get(userId);
    if (session?.loginId) await session.client.request('account/login/cancel', { loginId: session.loginId });
    this.close(userId); return { cancelled: true };
  }); }
  async disconnect(userId: string) { return this.mutate(userId, async () => {
    const session = await this.session(userId);
    if (session.loginId) await session.client.request('account/login/cancel', { loginId: session.loginId });
    await session.client.request('account/logout'); this.close(userId);
    return { disconnected: true, message: '이 앱 계정의 ChatGPT 연결을 해제했습니다.' };
  }); }
  async models(userId: string) {
    if (!await this.account(userId)) throw new AiError('먼저 본인 ChatGPT 계정으로 로그인해 주세요.', 400);
    const session = await this.session(userId);
    const models: { id: string; name: string }[] = []; let cursor: string | null = null;
    for (let page = 0; page < 10; page++) {
      const result: any = await session.client.request('model/list', { limit: 100, includeHidden: false, ...(cursor ? { cursor } : {}) });
      for (const item of result.data || []) if (!item.hidden && typeof item.model === 'string') models.push({ id: item.model, name: item.displayName || item.model });
      cursor = result.nextCursor; if (!cursor) break;
    }
    return models;
  }
  async selectModel(userId: string, model: string) {
    if (!(await this.models(userId)).some(item => item.id === model)) throw new BadRequestException('ChatGPT에서 선택할 수 없는 모델입니다.');
    const metadata = JSON.stringify({ model });
    await this.db.integration.upsert({ where: { userId_provider: { userId, provider: 'CHATGPT' } }, create: { userId, provider: 'CHATGPT', status: 'CONNECTED', metadata }, update: { status: 'CONNECTED', metadata } });
    return { model };
  }
  private async defaultModel(userId: string): Promise<string> {
    const saved = this.model((await this.row(userId))?.metadata);
    if (saved) return saved;
    const session = await this.session(userId);
    const result = await session.client.request('model/list', { limit: 100, includeHidden: false });
    const available = (result.data || []).filter((item: any) => !item.hidden && typeof item.model === 'string');
    const model = (available.find((item: any) => item.isDefault) || available[0])?.model;
    if (!model) throw new AiError('ChatGPT 기본 모델을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.', 503);
    const metadata = JSON.stringify({ model });
    await this.db.integration.upsert({ where: { userId_provider: { userId, provider: 'CHATGPT' } }, create: { userId, provider: 'CHATGPT', status: 'CONNECTED', metadata }, update: { status: 'CONNECTED', metadata } });
    return model;
  }
  async complete(userId: string, request: AiRequest): Promise<AiResult> {
    if (!await this.account(userId)) throw new AiError('설정에서 본인 ChatGPT 계정을 연결해 주세요.', 400);
    const model = request.model || await this.defaultModel(userId);
    if (request.model && !(await this.models(userId)).some(item => item.id === request.model)) throw new AiError('이 계정에서 선택할 수 없는 ChatGPT 모델입니다. 모델 목록을 다시 불러와 주세요.', 400);
    const cwd = await mkdtemp(join(tmpdir(), 'devmata-chatgpt-'));
    try {
      const text = await executeCodex(this.path(), this.home(userId), cwd, model, `${request.system}\n\n${request.prompt}`);
      return { text, model, provider: 'chatgpt', demo: false };
    } finally { await rm(cwd, { recursive: true, force: true }); }
  }
}

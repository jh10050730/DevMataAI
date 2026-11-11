import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { databaseFile } from '../prisma/database-url';
import { PrismaService } from '../prisma/prisma.service';
import { AiError, AiRequest, AiResult } from './ai.types';
import { GeminiAcpClient, geminiModels, GEMINI_CLIENT_UNSUPPORTED } from './gemini-acp.client';

type Pending = { client: GeminiAcpClient; id: number };
export type GeminiStatus = { enabled: boolean; installed: boolean; connected: boolean; pending: boolean; message: string; migrationRequired?: boolean; model?: string; email?: string };
@Injectable()
export class GeminiService implements OnModuleDestroy {
  private pending = new Map<string, Pending>();
  private epochs = new Map<string, number>();
  private starting = new Set<string>();
  private clients = new Set<GeminiAcpClient>();
  private probes = new Map<string, { expires: number; promise: Promise<ReturnType<typeof geminiModels>> }>();
  private destroyed = false;
  constructor(private readonly db: PrismaService, private readonly config: ConfigService) {}
  onModuleDestroy() { this.destroyed = true; for (const client of this.clients) client.close(); this.clients.clear(); this.pending.clear(); this.probes.clear(); }
  private launch() {
    const configured = this.config.get<string>('ANTIGRAVITY_CLI_PATH') || this.config.get<string>('GEMINI_CLI_PATH');
    if (configured && /\.(cmd|bat|ps1|[cm]?js)$/i.test(configured)) throw new AiError('Gemini 연결 실행 경로에는 공식 Antigravity CLI의 agy.exe 경로를 입력해 주세요.', 400);
    const executable = configured || join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'agy', 'bin', 'agy.exe');
    if (!existsSync(executable)) throw new AiError('Gemini 연결용 Antigravity CLI가 설치되지 않았습니다. 공식 설치 안내를 확인해 주세요.', 503);
    return { command: executable, args: [] as string[] };
  }
  private home(userId: string) { return join(dirname(databaseFile(this.config.getOrThrow<string>('DATABASE_URL'))), 'antigravity-accounts', createHash('sha256').update(userId).digest('hex')); }
  private row(userId: string) { return this.db.integration.findUnique({ where: { userId_provider: { userId, provider: 'GEMINI' } } }); }
  private migrationRequired(metadata?: string | null) { try { return JSON.parse(metadata || '{}').connectionError === 'CLIENT_UNSUPPORTED'; } catch { return false; } }
  private failureMetadata(error: unknown) { return JSON.stringify({ runtime: 'antigravity', connectionError: error instanceof AiError && error.message === GEMINI_CLIENT_UNSUPPORTED ? 'CLIENT_UNSUPPORTED' : 'AUTH_FAILED' }); }
  private catalog(session: unknown) { const catalog = geminiModels(session); return { ...catalog, models: catalog.models.filter(model => /^gemini[-\s]/i.test(model.id) || /^gemini\b/i.test(model.name)) }; }
  private close(client: GeminiAcpClient) { client.close(); this.clients.delete(client); }
  private async open(userId: string, interactive = false) {
    const launch = this.launch(), home = this.home(userId), cwd = join(home, 'work'), settings = join(home, 'app-settings.json');
    await mkdir(cwd, { recursive: true });
    const cliSettings = JSON.stringify({ permissions: { allow: [], ask: [], deny: ['read_file(*)', 'write_file(*)', 'read_url(*)', 'execute_url(*)', 'command(*)', 'mcp(*)'] }, useG1Credits: false, historySize: 0 });
    await writeFile(settings, cliSettings, 'utf8');
    const userSettingsDir = join(home, '.gemini', 'antigravity-cli');
    await mkdir(userSettingsDir, { recursive: true });
    await writeFile(join(userSettingsDir, 'settings.json'), cliSettings, 'utf8');
    if (this.destroyed) throw new AiError('앱이 종료 중입니다.', 503);
    const client = new GeminiAcpClient(launch.command, launch.args, home, settings, cwd, interactive);
    this.clients.add(client);
    try { const initialized = await client.initialize(); return { client, initialized, cwd }; } catch (error) { this.close(client); throw error; }
  }
  private probe(userId: string) {
    const cached = this.probes.get(userId); if (cached && cached.expires > Date.now()) return cached.promise;
    const promise = (async () => {
      const { client, cwd } = await this.open(userId);
      try { return this.catalog(await client.request('session/new', { cwd, mcpServers: [] })); } finally { this.close(client); }
    })();
    this.probes.set(userId, { expires: Date.now() + 10000, promise });
    return promise;
  }
  async status(userId: string): Promise<GeminiStatus> {
    try { this.launch(); } catch (error) { return { enabled: false, installed: false, connected: false, pending: false, message: error instanceof AiError ? error.message : 'Gemini 설치 상태를 확인해 주세요.' }; }
    if (this.pending.has(userId) || this.starting.has(userId)) return { enabled: true, installed: true, connected: false, pending: true, message: '브라우저에서 Google 계정 로그인을 완료해 주세요.' };
    const row = await this.row(userId);
    if (row?.status === 'FAILED' && this.migrationRequired(row.metadata)) return { enabled: true, installed: true, connected: false, pending: false, message: 'Gemini 연결이 Antigravity 방식으로 변경되었습니다. Google 계정으로 다시 연결해 주세요.' };
    if (!['CONNECTED', 'PENDING', 'FAILED'].includes(row?.status || '')) return { enabled: true, installed: true, connected: false, pending: false, message: '본인 Google 계정으로 Gemini를 연결해 주세요.' };
    try {
      const catalog = await this.probe(userId);
      if (row!.status !== 'CONNECTED') {
        const recovered = await this.db.integration.updateMany({ where: { userId, provider: 'GEMINI', status: row!.status, updatedAt: row!.updatedAt }, data: { status: 'CONNECTED', metadata: JSON.stringify({ runtime: 'antigravity' }) } });
        if (!recovered.count) return { enabled: true, installed: true, connected: false, pending: false, message: 'Gemini 연결 상태가 변경되었습니다. 다시 확인해 주세요.' };
      }
      return { enabled: true, installed: true, connected: true, pending: false, model: catalog.current, message: '본인 Google 계정으로 Gemini가 연결되었습니다.' };
    } catch (error) {
      const metadata = this.failureMetadata(error);
      if (row?.status === 'PENDING' || this.migrationRequired(metadata)) await this.db.integration.updateMany({ where: { userId, provider: 'GEMINI', status: row!.status, updatedAt: row!.updatedAt }, data: { status: 'FAILED', metadata } });
      return { enabled: true, installed: true, connected: false, pending: false, migrationRequired: this.migrationRequired(metadata), message: this.migrationRequired(metadata) ? GEMINI_CLIENT_UNSUPPORTED : 'Gemini 연결 상태를 확인하지 못했습니다. 다시 연결하거나 잠시 후 상태를 확인해 주세요.' };
    }
  }
  async start(userId: string) {
    if (this.starting.has(userId) || this.pending.has(userId)) throw new BadRequestException('이미 Gemini 로그인 중입니다.');
    this.starting.add(userId);
    const epoch = (this.epochs.get(userId) || 0) + 1; this.epochs.set(userId, epoch);
    let opened: Awaited<ReturnType<GeminiService['open']>> | undefined;
    try {
      opened = await this.open(userId, true);
      const method = opened.initialized.authMethods?.find((method: any) => method.id === 'oauth-personal' && (!method.type || method.type === 'agent'));
      if (!method) throw new AiError('이 Gemini 버전은 Google 계정 연결을 지원하지 않습니다. 최신 공식 CLI로 업데이트해 주세요.', 400);
      if (this.epochs.get(userId) !== epoch) throw new BadRequestException('Gemini 연결 요청이 취소되었습니다.');
      const row = await this.db.integration.upsert({ where: { userId_provider: { userId, provider: 'GEMINI' } }, create: { userId, provider: 'GEMINI', status: 'PENDING', metadata: JSON.stringify({ runtime: 'antigravity' }) }, update: { status: 'PENDING', metadata: JSON.stringify({ runtime: 'antigravity' }) } });
      if (this.epochs.get(userId) !== epoch) throw new BadRequestException('Gemini 연결 요청이 취소되었습니다.');
      const pending = { client: opened.client, id: epoch }; this.pending.set(userId, pending); this.probes.delete(userId);
      const client = opened.client;
      void client.request('authenticate', { methodId: method.id }, 600000).then(async () => {
        if (this.epochs.get(userId) !== epoch || this.destroyed) return;
        await client.request('session/new', { cwd: opened!.cwd, mcpServers: [] });
        if (this.epochs.get(userId) !== epoch || this.destroyed) return;
        await this.db.integration.updateMany({ where: { userId, provider: 'GEMINI', status: 'PENDING', updatedAt: row.updatedAt }, data: { status: 'CONNECTED' } });
      }).catch(async error => {
        if (this.epochs.get(userId) !== epoch || this.destroyed) return;
        await this.db.integration.updateMany({ where: { userId, provider: 'GEMINI', status: 'PENDING', updatedAt: row.updatedAt }, data: { status: 'FAILED', metadata: this.failureMetadata(error) } }).catch(() => undefined);
      }).finally(() => { if (this.pending.get(userId) === pending) this.pending.delete(userId); this.probes.delete(userId); this.close(client); });
      return { pending: true, message: 'Gemini의 공식 Google 로그인 창에서 로그인을 완료해 주세요.' };
    } catch (error) { if (opened) this.close(opened.client); throw error; }
    finally { this.starting.delete(userId); }
  }
  async disconnect(userId: string) {
    this.epochs.set(userId, (this.epochs.get(userId) || 0) + 1);
    const pending = this.pending.get(userId); if (pending) { this.pending.delete(userId); this.close(pending.client); }
    this.probes.delete(userId);
    await this.db.integration.upsert({ where: { userId_provider: { userId, provider: 'GEMINI' } }, create: { userId, provider: 'GEMINI', status: 'DISCONNECTED' }, update: { status: 'DISCONNECTED' } });
    return { disconnected: true, message: '이 앱의 Gemini 연결을 해제했습니다.' };
  }
  async models(userId: string) {
    if ((await this.row(userId))?.status !== 'CONNECTED') throw new AiError('먼저 Google 계정으로 Gemini를 연결해 주세요.', 400);
    return (await this.probe(userId)).models;
  }
  async complete(userId: string, request: AiRequest): Promise<AiResult> {
    if ((await this.row(userId))?.status !== 'CONNECTED') throw new AiError('설정에서 Gemini 계정을 연결해 주세요.', 400);
    const { client, cwd } = await this.open(userId);
    try {
      const session = await client.request('session/new', { cwd, mcpServers: [] });
      const catalog = this.catalog(session); const model = request.model || (catalog.models.some(item => item.id === catalog.current) ? catalog.current : catalog.models[0]?.id);
      if (!model || !catalog.models.some(item => item.id === model)) throw new AiError('이 계정에서 선택할 수 없는 Gemini 모델입니다. 목록을 다시 불러와 주세요.', 400);
      if (model !== catalog.current) await client.request(catalog.configId ? 'session/set_config_option' : 'session/set_model', catalog.configId ? { sessionId: session.sessionId, configId: catalog.configId, value: model } : { sessionId: session.sessionId, modelId: model });
      const text = await client.prompt(session.sessionId, `${request.system}\n\n${request.prompt}`);
      return { text, provider: 'gemini', model, demo: false };
    } finally { this.close(client); }
  }
}

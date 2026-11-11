import { HttpException, Injectable, Logger, Optional } from '@nestjs/common';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiError, AiProvider, AiRequest, AiResult } from './ai.types';
import { ClaudeCliProvider } from './providers/claude-cli.provider';
import { DemoProvider } from './providers/demo.provider';
import { ChatGptService } from './chatgpt.service';
import { createHash } from 'node:crypto';
import { ClaudeCodeService } from './claude-code.service';
import { GeminiService } from './gemini.service';

/** CLI 프로세스를 동시에 너무 많이 띄우지 않도록 제한 */
const MAX_CONCURRENT = 2;

/**
 * 모든 AI 호출의 단일 진입점. 프로바이더 교체, 동시 실행 제한, 사용량·오류 기록을 담당한다.
 * 다른 모듈은 프로바이더를 직접 쓰지 않고 이 서비스만 사용한다.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private inFlight = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly settings?: AppSettingsService,
    @Optional() private readonly chatgpt?: ChatGptService,
    @Optional() private readonly claudeCode?: ClaudeCodeService,
    @Optional() private readonly gemini?: GeminiService,
  ) {}

  private providerFor(selected?: string, model?: string): AiProvider {
    const config = { get: <T>(name: string, fallback?: unknown): T => (this.settings ? this.settings.getEnv(name) ?? fallback : this.config.get<T>(name) ?? fallback) as T };
    const name = selected || config.get<string>('AI_PROVIDER', 'claude-cli');
    return name === 'claude-cli' || name === 'both'
        ? new ClaudeCliProvider({
            path: config.get<string>('CLAUDE_CLI_PATH') || 'claude',
            model: model || config.get<string>('CLAUDE_CLI_MODEL') || undefined,
            timeoutMs: Number(config.get('CLAUDE_CLI_TIMEOUT_MS')) || 120_000,
          })
        : new DemoProvider(); // anthropic-api 는 추후 추가 (지금은 데모로 대체)
  }

  async selection(userId: string) {
    const row = await this.prisma.integration.findUnique({ where: { userId_provider: { userId, provider: 'AI_PREFERENCE' } } });
    let provider = this.config.get<string>('AI_PROVIDER', 'claude-cli');
    try { const saved = JSON.parse(row?.metadata || '{}'); if (['claude-cli', 'chatgpt', 'gemini', 'both'].includes(saved.provider)) provider = saved.provider; } catch { /* Use application default. */ }
    return { provider };
  }
  async select(userId: string, provider: 'claude-cli' | 'chatgpt' | 'gemini') {
    const metadata = JSON.stringify({ provider });
    await this.prisma.integration.upsert({ where: { userId_provider: { userId, provider: 'AI_PREFERENCE' } }, create: { userId, provider: 'AI_PREFERENCE', status: 'CONNECTED', metadata }, update: { metadata } });
    return { provider };
  }
  async connections(userId: string) {
    const [claudeAccount, chatgpt, preference, claudeLink, gemini] = await Promise.all([
      this.claudeCode?.connection() ?? Promise.resolve({ connected: false, installed: false, message: 'Claude 연결을 확인해 주세요.' }),
      this.chatgpt?.status(userId) ?? Promise.resolve({ connected: false, enabled: false, pending: false, message: 'ChatGPT 연결을 확인해 주세요.' }),
      this.selection(userId),
      this.prisma.integration.findUnique({ where: { userId_provider: { userId, provider: 'CLAUDE_CONNECTION' } } }),
      this.gemini?.status(userId) ?? Promise.resolve({ connected: false, enabled: false, pending: false, message: 'Gemini 연결을 확인해 주세요.' }),
    ]);
    const enabled = claudeLink?.status !== 'DISCONNECTED';
    const claude = { ...claudeAccount, loginConnected: claudeAccount.connected, enabled, connected: enabled && claudeAccount.connected, ...(enabled ? {} : { message: '이 앱의 Claude 연결을 해제했습니다. 다시 연결할 수 있습니다.' }) };
    const providers: ('claude-cli' | 'chatgpt' | 'gemini')[] = [];
    if (claude.connected) providers.push('claude-cli');
    if (chatgpt.connected) providers.push('chatgpt');
    if (gemini.connected) providers.push('gemini');
    const preferred = preference.provider === 'both' ? 'claude-cli' : preference.provider;
    const defaultProvider = providers.find(provider => provider === preferred) ?? providers.find(() => true);
    return { claude, chatgpt, gemini, providers, defaultProvider };
  }
  async connectClaude(userId: string) {
    if (!(await this.claudeCode?.connection())?.connected) throw new HttpException('먼저 Claude 계정으로 로그인한 뒤 다시 연결해 주세요.', 400);
    await this.setClaudeLink(userId, true);
    return { connected: true, message: '이 앱에 Claude를 연결했습니다.' };
  }
  async disconnectClaude(userId: string) {
    await this.setClaudeLink(userId, false);
    return { disconnected: true, message: '이 앱의 Claude 연결을 해제했습니다.' };
  }
  private setClaudeLink(userId: string, enabled: boolean) {
    const status = enabled ? 'CONNECTED' : 'DISCONNECTED';
    return this.prisma.integration.upsert({ where: { userId_provider: { userId, provider: 'CLAUDE_CONNECTION' } }, create: { userId, provider: 'CLAUDE_CONNECTION', status }, update: { status } });
  }
  private async defaultProvider(userId: string) {
    const preference = (await this.selection(userId)).provider;
    if (preference === 'demo') return preference;
    return (await this.connections(userId)).defaultProvider ?? 'none';
  }
  async models(userId: string) {
    const connections = await this.connections(userId);
    const groups: { provider: 'claude-cli' | 'chatgpt' | 'gemini'; label: string; models: { id: string; name: string }[]; message?: string }[] = [];
    if (connections.claude.connected) groups.push({ provider: 'claude-cli', label: 'Claude', models: [{ id: 'haiku', name: 'Haiku' }, { id: 'sonnet', name: 'Sonnet' }, { id: 'opus', name: 'Opus' }] });
    if (connections.chatgpt.connected) {
      try { groups.push({ provider: 'chatgpt', label: 'ChatGPT', models: await this.chatgpt!.models(userId) }); }
      catch { groups.push({ provider: 'chatgpt', label: 'ChatGPT', models: [], message: 'ChatGPT 모델을 불러오지 못했습니다. 계정 연결을 확인하고 다시 불러와 주세요.' }); }
    }
    if (connections.gemini.connected) {
      try { groups.push({ provider: 'gemini', label: 'Gemini', models: await this.gemini!.models(userId) }); }
      catch { groups.push({ provider: 'gemini', label: 'Gemini', models: [], message: 'Gemini 모델을 불러오지 못했습니다. 계정 연결을 확인해 주세요.' }); }
    }
    return { selection: connections.defaultProvider ?? '', groups };
  }
  /** Generated content must never reuse another user's/provider's/model's cache. */
  async cacheScope(userId: string) {
    const provider = await this.defaultProvider(userId);
    const account = ['chatgpt', 'gemini'].includes(provider) ? await this.prisma.integration.findUnique({ where: { userId_provider: { userId, provider: provider === 'gemini' ? 'GEMINI' : 'CHATGPT' } } }) : null;
    const key = createHash('sha256').update(JSON.stringify([userId, provider, account?.metadata, account?.updatedAt, this.config.get('CLAUDE_CLI_MODEL'), this.config.get('CLAUDE_CLI_PATH'), this.config.get('CODEX_CLI_PATH'), this.config.get('GEMINI_CLI_PATH')])).digest('hex');
    return { provider, key };
  }
  async status(userId?: string) {
    const selected = userId ? await this.defaultProvider(userId) : undefined;
    const provider = this.providerFor(selected);
    const account = userId && selected === 'chatgpt' && this.chatgpt ? await this.chatgpt.status(userId) : userId && selected === 'gemini' && this.gemini ? await this.gemini.status(userId) : null;
    const check = selected === 'none' ? { ok: false, detail: '설정에서 AI 계정을 연결해 주세요.' } : account ? { ok: account.connected && !!account.model, detail: account.connected ? `본인 ${selected === 'gemini' ? 'Gemini' : 'ChatGPT'} 계정 연결됨` : account.message } : await provider.available();
    const since = new Date(Date.now() - 86_400_000);
    const [calls, failures] = await Promise.all([
      this.prisma.aiUsageLog.count({ where: { createdAt: { gte: since } } }),
      this.prisma.aiUsageLog.count({ where: { createdAt: { gte: since }, success: false } }),
    ]);
    return { provider: selected === 'none' ? 'none' : selected === 'chatgpt' || selected === 'gemini' ? selected : provider.name, demo: selected !== 'none' && selected !== 'chatgpt' && selected !== 'gemini' && provider.name === 'demo', ...check, last24h: { calls, failures } };
  }

  async complete(userId: string, feature: string, req: AiRequest, expectedScope?: string): Promise<AiResult> {
    if (this.inFlight >= MAX_CONCURRENT) {
      throw new HttpException('AI 요청이 처리 중입니다. 잠시 후 다시 시도해주세요.', 429);
    }
    this.inFlight++;
    const started = Date.now();
    let attemptedProvider: string | undefined;
    try {
      const scope = expectedScope ? await this.cacheScope(userId) : null;
      if (scope && scope.key !== expectedScope) throw new AiError('AI 선택이 변경되었습니다. 다시 요청해 주세요.', 409);
      const selected = req.provider ?? scope?.provider ?? await this.defaultProvider(userId);
      attemptedProvider = selected;
      if (selected === 'none') throw new AiError('설정에서 AI 계정을 연결해 주세요.', 400);
      if (req.provider && !(await this.connections(userId)).providers.includes(req.provider)) throw new AiError('연결된 AI의 모델만 사용할 수 있습니다. 계정 연결을 확인하고 모델 목록을 새로 불러와 주세요.', 400);
      if (req.model && !req.provider) throw new AiError('모델과 AI 서비스를 함께 선택해 주세요.', 400);
      if (req.model && selected === 'claude-cli' && !['haiku', 'sonnet', 'opus'].includes(req.model)) throw new AiError('선택할 수 없는 Claude 모델입니다.', 400);
      if (selected === 'chatgpt' && !this.chatgpt) throw new AiError('ChatGPT 연결 기능을 사용할 수 없습니다.', 503);
      if (selected === 'gemini' && !this.gemini) throw new AiError('Gemini 연결 기능을 사용할 수 없습니다.', 503);
      const result = selected === 'gemini' ? await this.gemini!.complete(userId, req) : selected === 'chatgpt' ? await this.chatgpt!.complete(userId, req) : await this.providerFor(selected, req.model).complete(req);
      await this.log(userId, feature, req, started, { result });
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.log(userId, feature, req, started, { error: message, provider: attemptedProvider });
      this.logger.warn(`AI 호출 실패 [${feature}]: ${message}`); // 프롬프트 원문은 로그에 남기지 않음
      if (e instanceof AiError) throw new HttpException(e.message, e.status);
      throw new HttpException('AI 요청 중 오류가 발생했습니다.', 502);
    } finally {
      this.inFlight--;
    }
  }

  private async log(userId: string, feature: string, req: AiRequest, started: number, out: { result?: AiResult; error?: string; provider?: string }) {
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          feature,
          provider: out.result?.provider ?? out.provider ?? (await this.selection(userId)).provider,
          model: out.result?.model,
          success: !out.error,
          errorMessage: out.error?.slice(0, 500),
          latencyMs: Date.now() - started,
          inputChars: req.system.length + req.prompt.length,
          outputChars: out.result?.text.length ?? 0,
          inputTokens: out.result?.inputTokens,
          outputTokens: out.result?.outputTokens,
        },
      });
    } catch {
      /* 기록 실패가 응답을 막지 않도록 */
    }
  }
}

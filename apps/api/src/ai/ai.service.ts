import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiError, AiProvider, AiRequest, AiResult } from './ai.types';
import { ClaudeCliProvider } from './providers/claude-cli.provider';
import { DemoProvider } from './providers/demo.provider';

/** CLI 프로세스를 동시에 너무 많이 띄우지 않도록 제한 */
const MAX_CONCURRENT = 2;

/**
 * 모든 AI 호출의 단일 진입점. 프로바이더 교체, 동시 실행 제한, 사용량·오류 기록을 담당한다.
 * 다른 모듈은 프로바이더를 직접 쓰지 않고 이 서비스만 사용한다.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly provider: AiProvider;
  private inFlight = 0;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const name = config.get<string>('AI_PROVIDER', 'claude-cli');
    this.provider =
      name === 'claude-cli'
        ? new ClaudeCliProvider({
            path: config.get<string>('CLAUDE_CLI_PATH') || 'claude',
            model: config.get<string>('CLAUDE_CLI_MODEL') || undefined,
            timeoutMs: Number(config.get('CLAUDE_CLI_TIMEOUT_MS')) || 120_000,
          })
        : new DemoProvider(); // anthropic-api 는 추후 추가 (지금은 데모로 대체)
    if (name === 'anthropic-api') this.logger.warn('anthropic-api 프로바이더는 아직 구현되지 않아 demo 로 동작합니다.');
  }

  async status() {
    const check = await this.provider.available();
    const since = new Date(Date.now() - 86_400_000);
    const [calls, failures] = await Promise.all([
      this.prisma.aiUsageLog.count({ where: { createdAt: { gte: since } } }),
      this.prisma.aiUsageLog.count({ where: { createdAt: { gte: since }, success: false } }),
    ]);
    return { provider: this.provider.name, demo: this.provider.name === 'demo', ...check, last24h: { calls, failures } };
  }

  async complete(userId: string, feature: string, req: AiRequest): Promise<AiResult> {
    if (this.inFlight >= MAX_CONCURRENT) {
      throw new HttpException('AI 요청이 처리 중입니다. 잠시 후 다시 시도해주세요.', 429);
    }
    this.inFlight++;
    const started = Date.now();
    try {
      const result = await this.provider.complete(req);
      await this.log(userId, feature, req, started, { result });
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.log(userId, feature, req, started, { error: message });
      this.logger.warn(`AI 호출 실패 [${feature}]: ${message}`); // 프롬프트 원문은 로그에 남기지 않음
      if (e instanceof AiError) throw new HttpException(e.message, e.status);
      throw new HttpException('AI 요청 중 오류가 발생했습니다.', 502);
    } finally {
      this.inFlight--;
    }
  }

  private async log(userId: string, feature: string, req: AiRequest, started: number, out: { result?: AiResult; error?: string }) {
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          feature,
          provider: this.provider.name,
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

import { spawn } from 'node:child_process';
import * as os from 'node:os';
import { AiError, AiProvider, AiRequest, AiResult } from '../ai.types';

interface CliOptions {
  path: string;
  model?: string;
  timeoutMs: number;
}

interface CliJson {
  is_error?: boolean;
  result?: string;
  usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
  modelUsage?: Record<string, unknown>;
}

/**
 * 이 PC에 설치된 Claude Code 를 헤드리스(-p)로 호출한다. 구독 로그인을 사용하므로 API 키가 필요 없다.
 *
 * 토큰 절약을 위한 최소 모드:
 *  --safe-mode            : CLAUDE.md·플러그인·스킬·훅 등 사용자 설정을 불러오지 않음
 *  --tools ""             : 파일/셸 도구 비활성화 (텍스트 응답만)
 *  --strict-mcp-config    : MCP 서버 불러오지 않음
 *  --setting-sources ""   : 설정 파일 무시
 *  --system-prompt        : Claude Code 기본 시스템 프롬프트 대신 우리 프롬프트 사용
 * (--bare 는 구독 로그인을 쓰지 못해서 사용하지 않음)
 */
export class ClaudeCliProvider implements AiProvider {
  readonly name = 'claude-cli';

  constructor(private readonly opts: CliOptions) {}

  async available() {
    try {
      const out = await this.run(['--version'], '', 15_000);
      return { ok: true, detail: `Claude Code ${out.trim()}` };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : 'Claude Code 를 실행할 수 없습니다.' };
    }
  }

  async complete({ system, prompt }: AiRequest): Promise<AiResult> {
    const args = [
      '-p',
      '--output-format', 'json',
      '--safe-mode',
      '--tools', '',
      '--strict-mcp-config',
      '--setting-sources', '',
      '--no-session-persistence',
      '--system-prompt', system,
    ];
    if (this.opts.model) args.push('--model', this.opts.model);

    // 프롬프트는 길이 제한과 특수문자 문제를 피하려고 stdin 으로 전달
    const raw = await this.run(args, prompt, this.opts.timeoutMs);

    let json: CliJson;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AiError('Claude Code 응답을 해석하지 못했습니다.');
    }
    if (json.is_error || typeof json.result !== 'string') {
      const msg = json.result ?? '';
      if (/log ?in|\/login/i.test(msg)) {
        throw new AiError('Claude Code 에 로그인되어 있지 않습니다. 터미널에서 claude 를 실행해 로그인해주세요.', 503);
      }
      if (/limit|quota/i.test(msg)) throw new AiError('Claude 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.', 429);
      throw new AiError(`Claude Code 오류: ${msg.slice(0, 200) || '알 수 없는 오류'}`);
    }

    const u = json.usage ?? {};
    return {
      text: json.result.trim(),
      provider: this.name,
      model: Object.keys(json.modelUsage ?? {})[0] ?? this.opts.model,
      demo: false,
      inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
      outputTokens: u.output_tokens,
    };
  }

  private run(args: string[], stdin: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      // 환경에 API 키가 있으면 CLI 가 구독 대신 API 과금을 쓰므로 제거
      const env = { ...process.env };
      delete env.ANTHROPIC_API_KEY;
      delete env.ANTHROPIC_AUTH_TOKEN;

      let child;
      try {
        child = spawn(this.opts.path, args, {
          cwd: os.tmpdir(), // 프로젝트 폴더의 CLAUDE.md 등을 읽지 않도록
          env,
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        return reject(new AiError('Claude Code 를 실행할 수 없습니다. CLAUDE_CLI_PATH 를 확인해주세요.', 503));
      }

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new AiError(`AI 응답 시간이 초과되었습니다. (${Math.round(timeoutMs / 1000)}초)`, 504));
      }, timeoutMs);

      child.stdout.on('data', (d) => (stdout += d));
      child.stderr.on('data', (d) => (stderr += d));
      child.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        reject(
          new AiError(
            err.code === 'ENOENT'
              ? 'Claude Code 가 설치되어 있지 않거나 PATH 에 없습니다. CLAUDE_CLI_PATH 를 확인해주세요.'
              : 'Claude Code 를 실행할 수 없습니다.',
            503,
          ),
        );
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        // -p JSON 모드는 오류도 stdout JSON 으로 내보내므로 stdout 이 있으면 우선 사용
        if (stdout.trim()) return resolve(stdout);
        reject(new AiError(`Claude Code 가 비정상 종료했습니다. (code ${code}) ${stderr.slice(0, 200)}`.trim()));
      });

      child.stdin.on('error', () => undefined);
      child.stdin.end(stdin);
    });
  }
}

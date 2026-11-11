import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { join } from 'node:path';
import { AiError } from './ai.types';

export const GEMINI_CLIENT_UNSUPPORTED = 'Google이 개인 계정용 Gemini CLI 지원을 종료했습니다. Google 인증은 완료되어도 이 방식으로는 연결되지 않습니다. Antigravity 연결 방식으로 전환해야 합니다.';

export function geminiEnvironment(home: string, settings: string, interactive: boolean): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) if (/^(AGY_|ANTIGRAVITY_|GEMINI_|GOOGLE_|GCLOUD_|CLOUDSDK_|OPENAI_|ANTHROPIC_|NODE_OPTIONS$|NODE_PATH$)/.test(key)) delete env[key];
  delete env.NO_BROWSER;
  return { ...env, GEMINI_CLI_HOME: home, HOME: home, USERPROFILE: home, GEMINI_CLI_SYSTEM_SETTINGS_PATH: settings, GEMINI_CLI_SYSTEM_DEFAULTS_PATH: settings, GEMINI_CLI_NO_RELAUNCH: '1', GEMINI_TELEMETRY_ENABLED: 'false', ...(!interactive ? { NO_BROWSER: 'true' } : {}), ELECTRON_RUN_AS_NODE: '1' };
}
type Pending = { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
export class GeminiAcpClient {
  private child: ChildProcessWithoutNullStreams;
  private closed = false;
  private sequence = 0;
  private buffer = '';
  private bytes = 0;
  private pending = new Map<number, Pending>();
  private answer = '';
  private promptSession?: string;
  constructor(command: string, args: string[], home: string, settings: string, cwd: string, interactive = false) {
    this.child = spawn(command, [...args, 'acp', '--gemini-dir', join(home, '.gemini'), '--app-data-dir', 'antigravity-cli', '--include-default-customizations=false', '--disable-telemetry'], { cwd, env: geminiEnvironment(home, settings, interactive), shell: false, windowsHide: true });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => {
      this.bytes += Buffer.byteLength(chunk); this.buffer += chunk;
      if (this.bytes > 4 * 1024 * 1024 || this.buffer.length > 2 * 1024 * 1024) return this.close(new AiError('Gemini 응답이 너무 큽니다.'));
      let index: number;
      while ((index = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, index); this.buffer = this.buffer.slice(index + 1);
        if (!line.trim()) continue;
        try { this.receive(JSON.parse(line)); } catch { this.close(new AiError('Gemini 연결 응답 형식이 올바르지 않습니다.')); }
      }
    });
    this.child.stderr.resume(); // OAuth diagnostics and credentials must not enter app logs.
    this.child.stdin.on('error', () => this.close());
    this.child.on('error', () => this.close(new AiError('Gemini 연결 프로그램을 실행하지 못했습니다. 설치 경로를 확인해 주세요.', 503)));
    this.child.on('close', () => this.close());
  }
  private receive(value: any) {
    if (value.method && value.id !== undefined) {
      const response = value.method === 'session/request_permission' ? { result: { outcome: { outcome: 'cancelled' } } } : { error: { code: -32601, message: 'Client tools are disabled' } };
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: value.id, ...response }) + '\n');
      return;
    }
    if (value.method === 'session/update' && value.params?.sessionId === this.promptSession) {
      const update = value.params.update;
      if (['tool_call', 'tool_call_update'].includes(update?.sessionUpdate)) return this.close(new AiError('Gemini가 허용되지 않은 도구를 요청했습니다.'));
      if (update?.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text' && typeof update.content.text === 'string') this.answer += update.content.text;
    }
    const pending = this.pending.get(value.id); if (!pending) return;
    clearTimeout(pending.timer); this.pending.delete(value.id);
    if (value.error) pending.reject(new AiError(/client is no longer supported for Gemini Code Assist for individuals/i.test(String(value.error.message)) ? GEMINI_CLIENT_UNSUPPORTED : 'Gemini 연결 또는 요청에 실패했습니다. Google 계정 로그인·사용 권한·한도를 확인해 주세요.', 400));
    else pending.resolve(value.result);
  }
  request<T = any>(method: string, params: Record<string, unknown> = {}, timeout = 30000): Promise<T> {
    if (this.closed) return Promise.reject(new AiError('Gemini 연결이 종료되었습니다. 다시 시도해 주세요.', 503));
    return new Promise<T>((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new AiError('Gemini 연결 응답 시간이 초과되었습니다.', 504)); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  initialize() { return this.request('initialize', { protocolVersion: 1, clientInfo: { name: 'devmata-ai', version: '0.1.0' }, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } }); }
  async prompt(sessionId: string, prompt: string) {
    this.promptSession = sessionId; this.answer = '';
    try {
      const result = await this.request('session/prompt', { sessionId, prompt: [{ type: 'text', text: prompt }] }, 120000);
      if (result.stopReason !== 'end_turn' || !this.answer.trim()) throw new AiError('Gemini의 완성된 응답을 받지 못했습니다.');
      return this.answer.trim();
    } finally { this.promptSession = undefined; this.answer = ''; }
  }
  close(error = new AiError('Gemini 연결이 종료되었습니다.', 503)) {
    if (this.closed) return;
    this.closed = true;
    for (const value of this.pending.values()) { clearTimeout(value.timer); value.reject(error); }
    this.pending.clear(); this.child.kill();
  }
}

export function geminiModels(session: any): { current?: string; configId?: string; models: { id: string; name: string }[] } {
  const config = session.configOptions?.find((value: any) => value.category === 'model' && value.type === 'select');
  const flatten = (options: any[]): any[] => options.flatMap(option => Array.isArray(option.options) ? flatten(option.options) : [option]);
  const models = config ? flatten(config.options || []).filter(option => typeof option.value === 'string').map(option => ({ id: option.value, name: option.name || option.value })) : (session.models?.availableModels || []).filter((model: any) => typeof model.modelId === 'string').map((model: any) => ({ id: model.modelId, name: model.name || model.modelId }));
  const current = config?.currentValue || session.models?.currentModelId;
  if (!models.length && typeof current === 'string') models.push({ id: current, name: current });
  return { current, configId: config?.id, models };
}

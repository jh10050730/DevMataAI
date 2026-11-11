import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { AiError } from './ai.types';

// Codex owns authentication; the app never reads its token files.
export function codexEnvironment(home: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, CODEX_HOME: home };
  for (const key of Object.keys(env)) if (/^(OPENAI_|CODEX_(API_KEY|ACCESS_TOKEN|AUTH|CONFIG|MANAGED|PROFILE))/.test(key)) delete env[key];
  return env;
}
export const CODEX_OVERRIDES = [
  'approval_policy="never"', 'web_search="disabled"', 'project_doc_max_bytes=0', 'agents.enabled=false', 'cli_auth_credentials_store="file"', 'model_provider="openai"',
  ...['shell_tool', 'unified_exec', 'hooks', 'plugins', 'apps', 'browser_use', 'computer_use', 'image_generation', 'view_image'].map(key => `features.${key}=false`),
].flatMap(value => ['-c', value]);
type Pending = { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
export class CodexClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private sequence = 0;
  private pending = new Map<number, Pending>();
  private buffer = '';
  private closed = false;
  loginFinished = false;
  constructor(path: string, home: string, cwd: string) {
    this.child = spawn(path, ['app-server', '--listen', 'stdio://', ...CODEX_OVERRIDES], { env: codexEnvironment(home), cwd, shell: false, windowsHide: true });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      if (this.buffer.length > 2 * 1024 * 1024) return this.close();
      let end: number;
      while ((end = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1);
        try { this.receive(JSON.parse(line)); } catch { this.close(); }
      }
    });
    this.child.stderr.resume(); // Do not record login diagnostics.
    this.child.stdin.on('error', () => this.close());
    this.child.on('error', () => this.close());
    this.child.on('close', () => this.close());
  }
  private receive(value: any) {
    if (value.method === 'account/login/completed') this.loginFinished = true;
    if (value.id !== undefined && value.method) {
      this.child.stdin.write(JSON.stringify({ id: value.id, error: { code: -32601, message: 'Unsupported method' } }) + '\n'); return;
    }
    const pending = this.pending.get(value.id); if (!pending) return;
    clearTimeout(pending.timer); this.pending.delete(value.id);
    if (value.error) pending.reject(new AiError('ChatGPT 연결 요청을 처리하지 못했습니다. 연결 프로그램 업데이트와 계정 상태를 확인해 주세요.', 400));
    else pending.resolve(value.result);
  }
  async initialize() {
    await this.request('initialize', { clientInfo: { name: 'devmata_ai', title: 'DevMata AI', version: '0.1.0' } });
    this.child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  }
  request<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (this.closed) return Promise.reject(new AiError('ChatGPT 연결이 종료되었습니다. 다시 시도해 주세요.', 503));
    return new Promise<T>((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new AiError('ChatGPT 연결 응답 시간이 초과되었습니다.', 504)); }, 20000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new AiError('ChatGPT 연결이 종료되었습니다. 연결 프로그램 설치와 로그인을 확인해 주세요.', 503)); }
    this.pending.clear(); this.child.kill();
  }
}

export function parseCodexOutput(output: string): string {
  let text = ''; let completed = false;
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    let value: any;
    try { value = JSON.parse(line); } catch { throw new AiError('ChatGPT 응답 형식이 올바르지 않습니다.'); }
    if (value.type === 'error' || value.type === 'turn.failed') throw new AiError('ChatGPT 요청에 실패했습니다. 계정 사용 한도와 연결 상태를 확인해 주세요.');
    if (value.type === 'item.completed' && value.item?.type === 'agent_message') text = value.item.text;
    if (value.type === 'turn.completed') completed = true;
    if (value.item && ['command_execution', 'mcp_tool_call', 'web_search', 'file_change'].includes(value.item.type)) throw new AiError('ChatGPT가 허용되지 않은 도구를 요청했습니다.');
  }
  if (!completed || typeof text !== 'string' || !text.trim()) throw new AiError('ChatGPT의 완성된 응답을 받지 못했습니다.');
  return text;
}
export function executeCodex(path: string, home: string, cwd: string, model: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(path, ['exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--json', '--color', 'never', ...CODEX_OVERRIDES, '--model', model, '-'], { env: codexEnvironment(home), cwd, shell: false, windowsHide: true });
    let output = ''; let settled = false;
    const finish = (error?: Error, result?: string) => { if (settled) return; settled = true; clearTimeout(timer); if (error) { child.kill(); reject(error); } else resolve(result!); };
    const timer = setTimeout(() => finish(new AiError('ChatGPT 응답 시간이 초과되었습니다.', 504)), 120000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { output += chunk; if (output.length > 2 * 1024 * 1024) finish(new AiError('ChatGPT 응답이 너무 큽니다.')); });
    child.stderr.resume(); child.stdin.on('error', () => finish(new AiError('ChatGPT에 요청을 전달하지 못했습니다.')));
    child.on('error', () => finish(new AiError('ChatGPT 연결 프로그램을 실행하지 못했습니다. 실행 경로를 확인해 주세요.', 503)));
    child.on('close', code => { if (settled) return; if (code !== 0) return finish(new AiError('ChatGPT 요청에 실패했습니다. 계정 사용 한도와 연결 프로그램 업데이트를 확인해 주세요.')); try { finish(undefined, parseCodexOutput(output)); } catch (e) { finish(e as Error); } });
    child.stdin.end(prompt);
  });
}

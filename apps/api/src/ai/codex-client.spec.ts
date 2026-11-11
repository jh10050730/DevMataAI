import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { CodexClient, codexEnvironment, executeCodex, parseCodexOutput } from './codex-client';
jest.mock('node:child_process', () => ({ ...jest.requireActual('node:child_process'), spawn: jest.fn() }));
const message = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'answer' } });
const completed = JSON.stringify({ type: 'turn.completed', usage: {} });
describe('Codex process boundary', () => {
  let child: any;
  beforeEach(() => { child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), stdin: new PassThrough(), kill: jest.fn() }); (spawn as jest.Mock).mockReturnValue(child); });
  it('accepts only completed JSONL answers', () => {
    expect(parseCodexOutput(`${message}\n${completed}\n`)).toBe('answer');
    for (const output of [message, 'bad json', completed, `${message}\n${JSON.stringify({ type: 'turn.failed' })}`, `${JSON.stringify({ type: 'item.started', item: { type: 'command_execution' } })}\n${completed}`]) expect(() => parseCodexOutput(output)).toThrow();
  });
  it('removes inherited API credentials and isolates CODEX_HOME', () => {
    const old = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'never-forward';
    try { const env = codexEnvironment('/app/account'); expect(env.OPENAI_API_KEY).toBeUndefined(); expect(env.CODEX_HOME).toBe('/app/account'); } finally { if (old === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = old; }
  });
  it('uses stdin with no shell, read-only sandbox and tool disabling', async () => {
    let input = ''; child.stdin.on('data', (data: Buffer) => { input += data.toString(); });
    const result = executeCodex('codex.exe', '/private', '/empty', 'model', '$(malicious); prompt');
    child.stdout.write(`${message}\n${completed}\n`); child.emit('close', 0);
    await expect(result).resolves.toBe('answer');
    const [, args, options] = (spawn as jest.Mock).mock.calls[0];
    expect(options).toMatchObject({ shell: false, windowsHide: true, cwd: '/empty' });
    expect(args).toEqual(expect.arrayContaining(['--ignore-user-config', '--ignore-rules', '--ephemeral', 'read-only', 'features.shell_tool=false', 'features.hooks=false']));
    expect(args).not.toContain('$(malicious); prompt'); expect(input).toBe('$(malicious); prompt');
  });
  it('rejects nonzero exits even when partial text arrived', async () => {
    const result = executeCodex('codex.exe', '/private', '/empty', 'model', 'question');
    child.stdout.write(message); child.emit('close', 1); await expect(result).rejects.toThrow('실패');
  });
  it('handles fragmented RPC frames and refuses server tool requests', async () => {
    const client = new CodexClient('codex.exe', '/private', '/empty'); let writes = '';
    child.stdin.on('data', (chunk: Buffer) => { writes += chunk.toString(); });
    const init = client.initialize(); child.stdout.write('{"id":1,"res'); child.stdout.write('ult":{}}\n'); await init;
    const request = client.request('account/read'); child.stdout.write('{"id":2,"result":{"account":null}}\n'); await expect(request).resolves.toEqual({ account: null });
    child.stdout.write('{"id":99,"method":"item/commandExecution/requestApproval"}\n'); expect(writes).toContain('Unsupported method');
    client.close(); expect(child.kill).toHaveBeenCalled();
  });
  it('fails pending RPC requests when the CLI exits', async () => {
    const client = new CodexClient('codex.exe', '/private', '/empty'); const result = client.request('account/read'); child.emit('close', 1);
    await expect(result).rejects.toThrow('종료'); client.close();
  });
});

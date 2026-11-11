import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { GeminiAcpClient, geminiEnvironment, geminiModels, GEMINI_CLIENT_UNSUPPORTED } from './gemini-acp.client';
jest.mock('node:child_process', () => ({ ...jest.requireActual('node:child_process'), spawn: jest.fn() }));
describe('Gemini ACP boundary', () => {
  let child: any;
  beforeEach(() => { child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), stdin: new PassThrough(), kill: jest.fn() }); (spawn as jest.Mock).mockReturnValue(child); });
  afterEach(() => jest.clearAllMocks());
  const send = (value: unknown) => child.stdout.write(JSON.stringify(value) + '\n');
  it('isolates home, strips billing credentials and prevents automatic browser launches', () => {
    const previous = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = 'never-forward';
    try {
      expect(geminiEnvironment('/private', '/settings', false)).toMatchObject({ GEMINI_CLI_HOME: '/private', NO_BROWSER: 'true', GEMINI_CLI_NO_RELAUNCH: '1' });
      expect(geminiEnvironment('/private', '/settings', false).GEMINI_API_KEY).toBeUndefined();
      expect(geminiEnvironment('/private', '/settings', true).NO_BROWSER).toBeUndefined();
    } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
  });
  it('uses a shell-free ACP handshake and accepts fragmented responses', async () => {
    const client = new GeminiAcpClient('node', ['gemini.js'], '/home', '/settings', '/work');
    const result = client.initialize();
    child.stdout.write('{"jsonrpc":"2.0","id":1,"result":'); child.stdout.write('{"authMethods":[]}}\n');
    await expect(result).resolves.toEqual({ authMethods: [] });
    expect(spawn).toHaveBeenCalledWith('node', ['gemini.js', 'acp', '--gemini-dir', join('/home', '.gemini'), '--app-data-dir', 'antigravity-cli', '--include-default-customizations=false', '--disable-telemetry'], expect.objectContaining({ shell: false, windowsHide: true, cwd: '/work' })); client.close();
  });
  it('reports consumer support termination without exposing raw server errors', async () => {
    const client = new GeminiAcpClient('node', [], '/home', '/settings', '/work');
    const result = client.request('authenticate');
    send({ id: 1, error: { code: -32000, message: 'This client is no longer supported for Gemini Code Assist for individuals. secret-detail' } });
    await expect(result).rejects.toThrow(GEMINI_CLIENT_UNSUPPORTED); client.close();
  });
  it('returns only the current session final answer and omits thoughts', async () => {
    const client = new GeminiAcpClient('node', [], '/home', '/settings', '/work'); const result = client.prompt('s1', 'question');
    for (const [sessionId, kind, text] of [['other', 'agent_message_chunk', 'wrong account'], ['s1', 'agent_thought_chunk', 'private reasoning'], ['s1', 'agent_message_chunk', '답변']]) send({ method: 'session/update', params: { sessionId, update: { sessionUpdate: kind, content: { type: 'text', text } } } });
    send({ id: 1, result: { stopReason: 'end_turn' } }); await expect(result).resolves.toBe('답변'); client.close();
  });
  it('rejects incomplete answers and aborts tool use', async () => {
    const client = new GeminiAcpClient('node', [], '/home', '/settings', '/work'); const result = client.prompt('s1', 'question');
    send({ id: 1, result: { stopReason: 'cancelled' } }); await expect(result).rejects.toThrow('완성된 응답'); client.close();
    const second = new GeminiAcpClient('node', [], '/home', '/settings', '/work'); const answer = second.prompt('s2', 'question');
    send({ method: 'session/update', params: { sessionId: 's2', update: { sessionUpdate: 'tool_call' } } }); await expect(answer).rejects.toThrow('도구'); second.close();
  });
  it('denies tool permissions and filesystem methods', () => {
    const client = new GeminiAcpClient('node', [], '/home', '/settings', '/work'); let output = '';
    child.stdin.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    send({ id: 90, method: 'session/request_permission' }); send({ id: 91, method: 'fs/read_text_file' });
    expect(output).toContain('cancelled'); expect(output).toContain('Client tools are disabled'); client.close();
  });
  it('uses legacy and modern model catalogs without hardcoding model names', () => {
    expect(geminiModels({ models: { currentModelId: 'account-model', availableModels: [{ modelId: 'account-model', name: 'Account model' }] } })).toMatchObject({ current: 'account-model', models: [{ id: 'account-model', name: 'Account model' }] });
    expect(geminiModels({ configOptions: [{ id: 'model', category: 'model', type: 'select', currentValue: 'x', options: [{ name: 'Group', options: [{ value: 'x', name: 'Actual X' }] }] }] })).toMatchObject({ configId: 'model', models: [{ id: 'x', name: 'Actual X' }] });
  });
});

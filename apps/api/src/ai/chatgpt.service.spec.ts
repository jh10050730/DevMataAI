import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatGptService } from './chatgpt.service';
import { CodexClient, executeCodex } from './codex-client';

jest.mock('./codex-client', () => ({ CodexClient: jest.fn(), executeCodex: jest.fn() }));
describe('ChatGPT account through Codex', () => {
  let root: string; let service: ChatGptService;
  const clients: any[] = [];
  const rows = new Map<string, any>();
  const db: any = { integration: {
    findUnique: jest.fn(async ({ where }) => rows.get(where.userId_provider.userId)),
    upsert: jest.fn(async ({ where, create, update }) => { const id = where.userId_provider.userId; rows.set(id, rows.has(id) ? { ...rows.get(id), ...update } : create); }),
  } };
  beforeEach(async () => {
    jest.clearAllMocks(); clients.length = 0; rows.clear();
    root = await mkdtemp(join(tmpdir(), 'devmata-codex-test-'));
    (CodexClient as jest.Mock).mockImplementation((path, home) => {
      const client = { home, path, loginFinished: false, initialize: jest.fn().mockResolvedValue(undefined), close: jest.fn(), request: jest.fn(async (method: string) => {
        if (method === 'account/read') return { account: { type: 'chatgpt', email: 'user@example.com', planType: 'plus' } };
        if (method === 'account/login/start') return { authUrl: 'https://auth.openai.com/authorize?state=test', loginId: 'login-1' };
        if (method === 'model/list') return { data: [{ model: 'available-model', displayName: 'Available model' }, { model: 'hidden', hidden: true }] };
        return {};
      }) }; clients.push(client); return client;
    });
    service = new ChatGptService(db, new ConfigService({ DATABASE_URL: `file:${join(root, 'test.db')}`, CODEX_CLI_PATH: 'codex.exe' }));
  });
  afterEach(async () => { service.onModuleDestroy(); await rm(root, { recursive: true, force: true }); });
  it('separates each app user from global Codex credentials and exposes no tokens', async () => {
    const [a, b] = await Promise.all([service.status('user-a'), service.status('user-b')]);
    expect(a.connected && b.connected).toBe(true);
    expect(clients[0].home).not.toBe(clients[1].home);
    expect(clients[0].home).toContain('codex-accounts');
    expect(JSON.stringify(a)).not.toMatch(/token/i);
  });
  it('uses only managed ChatGPT login and cancellation', async () => {
    expect((await service.start('user-a')).url).toMatch(/^https:\/\/auth.openai.com\//);
    expect(clients[0].request).toHaveBeenCalledWith('account/login/start', { type: 'chatgpt' });
    await expect(service.start('user-a')).rejects.toThrow('이미 로그인');
    await service.cancel('user-a');
    expect(clients[0].request).toHaveBeenCalledWith('account/login/cancel', { loginId: 'login-1' });
    expect(clients[0].close).toHaveBeenCalled();
  });
  it('does not accept API-key accounts as a ChatGPT subscription', async () => {
    await service.status('user-a');
    clients[0].request.mockResolvedValue({ account: { type: 'apiKey' } });
    expect((await service.status('user-a')).connected).toBe(false);
    await expect(service.complete('user-a', { system: 's', prompt: 'p' })).rejects.toThrow('연결');
    expect(executeCodex).not.toHaveBeenCalled();
  });
  it('stores only a selected model and executes the selected account without a fallback', async () => {
    expect(await service.models('user-a')).toEqual([{ id: 'available-model', name: 'Available model' }]);
    await expect(service.selectModel('user-a', 'unknown')).rejects.toThrow('선택할 수 없는');
    await service.selectModel('user-a', 'available-model');
    expect(rows.get('user-a')).toEqual({ userId: 'user-a', provider: 'CHATGPT', status: 'CONNECTED', metadata: JSON.stringify({ model: 'available-model' }) });
    (executeCodex as jest.Mock).mockResolvedValue('실제 응답');
    expect(await service.complete('user-a', { system: '규칙', prompt: '질문' })).toMatchObject({ provider: 'chatgpt', demo: false, text: '실제 응답' });
    expect(executeCodex).toHaveBeenCalledWith('codex.exe', clients[0].home, expect.stringContaining('devmata-chatgpt-'), 'available-model', '규칙\n\n질문');
    (executeCodex as jest.Mock).mockRejectedValue(new Error('quota'));
    await expect(service.complete('user-a', { system: '', prompt: '' })).rejects.toThrow('quota');
  });
  it('logs out only the dedicated app account through the CLI', async () => {
    await service.disconnect('user-a');
    expect(clients[0].request).toHaveBeenCalledWith('account/logout');
    expect(clients[0].close).toHaveBeenCalled();
  });
  it('validates a per-request model without persisting it as the default', async () => {
    await service.status('user-a'); const previous = rows.get('user-a').metadata;
    clients[0].request.mockImplementation(async (method: string) => method === 'account/read' ? { account: { type: 'chatgpt' } } : { data: [{ model: 'other-model' }] });
    (executeCodex as jest.Mock).mockResolvedValue('다른 모델 응답');
    expect(await service.complete('user-a', { system: 's', prompt: 'p', model: 'other-model' })).toMatchObject({ model: 'other-model' });
    expect(rows.get('user-a').metadata).toBe(previous);
    await expect(service.complete('user-a', { system: 's', prompt: 'p', model: 'not-in-catalog' })).rejects.toThrow('ChatGPT 모델');
  });
  it('automatically prepares the default model after login without asking the user', async () => {
    const status = await service.status('user-a');
    expect(status).toMatchObject({ connected: true, model: 'available-model' });
    expect(rows.get('user-a').metadata).toBe(JSON.stringify({ model: 'available-model' }));
    (executeCodex as jest.Mock).mockResolvedValue('자동 모델 응답');
    expect(await service.complete('user-a', { system: 's', prompt: 'p' })).toMatchObject({ model: 'available-model', text: '자동 모델 응답' });
  });
  it('prefers the account catalog default and keeps login connected if model lookup fails', async () => {
    await service.status('user-a'); rows.clear();
    clients[0].request.mockImplementation(async (method: string) => method === 'account/read' ? { account: { type: 'chatgpt' } } : { data: [{ model: 'first' }, { model: 'recommended', isDefault: true }] });
    expect((await service.status('user-a')).model).toBe('recommended');
    rows.clear();
    clients[0].request.mockImplementation(async (method: string) => { if (method === 'account/read') return { account: { type: 'chatgpt' } }; throw new Error('network'); });
    expect(await service.status('user-a')).toMatchObject({ connected: true, enabled: true });
  });
  it('rejects shell shims and untrusted authorization links', async () => {
    const shim = new ChatGptService(db, new ConfigService({ DATABASE_URL: `file:${join(root, 'test.db')}`, CODEX_CLI_PATH: 'codex.cmd' }));
    expect((await shim.status('user-a')).enabled).toBe(false); shim.onModuleDestroy();
    await service.status('user-a');
    clients[0].request.mockResolvedValue({ authUrl: 'https://example.com/login', loginId: 'bad' });
    await expect(service.start('user-a')).rejects.toThrow('공식 로그인');
  });
});

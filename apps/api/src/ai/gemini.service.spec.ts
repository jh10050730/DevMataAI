import { ConfigService } from '@nestjs/config';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GeminiService } from './gemini.service';
import { GeminiAcpClient, GEMINI_CLIENT_UNSUPPORTED } from './gemini-acp.client';
import { AiError } from './ai.types';
jest.mock('./gemini-acp.client', () => ({ ...jest.requireActual('./gemini-acp.client'), GeminiAcpClient: jest.fn() }));
describe('Gemini Google-account integration', () => {
  let root: string; let service: GeminiService; let authResolve: () => void;
  const clients: any[] = []; const rows = new Map<string, any>();
  const db: any = { integration: {
    findUnique: jest.fn(async ({ where }) => rows.get(where.userId_provider.userId)),
    upsert: jest.fn(async ({ where, create, update }) => { const id = where.userId_provider.userId; const row = { ...(rows.get(id) || create), ...update, updatedAt: new Date() }; rows.set(id, row); return row; }),
    updateMany: jest.fn(async ({ where, data }) => { const row = rows.get(where.userId); if (row?.status === where.status && +row.updatedAt === +where.updatedAt) { rows.set(where.userId, { ...row, ...data }); return { count: 1 }; } return { count: 0 }; }),
  } };
  beforeEach(async () => {
    jest.clearAllMocks(); rows.clear(); clients.length = 0;
    root = await mkdtemp(join(tmpdir(), 'devmata-gemini-test-')); const script = join(root, 'agy.exe'); await writeFile(script, '// fixture');
    (GeminiAcpClient as jest.Mock).mockImplementation((command, args, home, settings, cwd, interactive) => {
      const client: any = { home, settings, interactive, initialize: jest.fn().mockResolvedValue({ authMethods: [{ id: 'oauth-personal' }] }), close: jest.fn(), prompt: jest.fn().mockResolvedValue('Gemini 답변'), request: jest.fn(async (method: string) => {
        if (method === 'authenticate') return new Promise((resolve, reject) => { authResolve = () => resolve({}); client.authReject = reject; });
        if (method === 'session/new') return { sessionId: 's1', models: { currentModelId: 'model-a', availableModels: [{ modelId: 'model-a', name: 'Gemini A' }, { modelId: 'model-b', name: 'Gemini B' }, { modelId: 'claude-model', name: 'Claude' }] } };
        return {};
      }) };
      client.close.mockImplementation(() => client.authReject?.(new Error('closed'))); clients.push(client); return client;
    });
    service = new GeminiService(db, new ConfigService({ DATABASE_URL: `file:${join(root, 'test.db')}`, ANTIGRAVITY_CLI_PATH: script }));
  });
  afterEach(async () => { service.onModuleDestroy(); await new Promise(resolve => setImmediate(resolve)); await rm(root, { recursive: true, force: true }); });
  it('never starts Google login automatically on a status check', async () => {
    expect(await service.status('a')).toMatchObject({ enabled: true, connected: false, pending: false }); expect(GeminiAcpClient).not.toHaveBeenCalled();
  });
  it('handles missing installations and refuses shell shims', async () => {
    for (const path of [join(root, 'missing.exe'), 'gemini.cmd', 'index.js']) {
      const unavailable = new GeminiService(db, new ConfigService({ GEMINI_CLI_PATH: path }));
      expect((await unavailable.status('a')).enabled).toBe(false); unavailable.onModuleDestroy();
    }
  });
  it('detects the official Antigravity Windows installation', async () => {
    const previous = process.env.LOCALAPPDATA; process.env.LOCALAPPDATA = root;
    const cli = new GeminiService(db, new ConfigService({}));
    try {
      for (const relative of ['agy/bin/agy.exe']) {
        const script = join(root, relative);
        await mkdir(join(script, '..'), { recursive: true }); await writeFile(script, '// fixture');
        expect(await cli.status('a')).toMatchObject({ enabled: true, installed: true, connected: false });
        await rm(script);
      }
    } finally { if (previous === undefined) delete process.env.LOCALAPPDATA; else process.env.LOCALAPPDATA = previous; cli.onModuleDestroy(); }
  });
  it('uses only official Google authentication and stores no app DB credentials', async () => {
    await service.start('a'); expect((await service.status('a')).pending).toBe(true);
    expect(clients[0].request).toHaveBeenCalledWith('authenticate', { methodId: 'oauth-personal' }, 600000);
    authResolve(); await new Promise(resolve => setImmediate(resolve));
    expect((await service.status('a')).connected).toBe(true);
    expect(await service.models('a')).toEqual([{ id: 'model-a', name: 'Gemini A' }, { id: 'model-b', name: 'Gemini B' }]);
    expect(JSON.stringify(rows.get('a'))).not.toMatch(/accessToken|refreshToken/);
    expect(JSON.parse(await readFile(clients[0].settings, 'utf8'))).toMatchObject({ useG1Credits: false, permissions: { allow: [], deny: expect.arrayContaining(['command(*)', 'read_file(*)', 'write_file(*)', 'mcp(*)']) } });
    expect(JSON.parse(await readFile(join(clients[0].home, '.gemini', 'antigravity-cli', 'settings.json'), 'utf8'))).toMatchObject({ useG1Credits: false, historySize: 0 });
  });
  it('isolates app users and enables browser auth only after an explicit start', async () => {
    await service.start('a'); await service.start('b'); expect(clients[0].home).not.toBe(clients[1].home); expect(clients[0].interactive).toBe(true);
    rows.set('c', { status: 'CONNECTED' }); await service.status('c'); expect(clients[2].interactive).toBe(false);
  });
  it('keeps disconnect persistent even if an old login finishes later', async () => {
    await service.start('a'); await service.disconnect('a'); authResolve(); await new Promise(resolve => setImmediate(resolve));
    expect(rows.get('a').status).toBe('DISCONNECTED'); expect((await service.status('a')).connected).toBe(false);
    await expect(service.complete('a', { system: '', prompt: '' })).rejects.toThrow('연결');
  });
  it('recovers a completed login left pending without opening a browser', async () => {
    rows.set('a', { status: 'PENDING', updatedAt: new Date() });
    expect(await service.status('a')).toMatchObject({ connected: true, pending: false });
    expect(rows.get('a').status).toBe('CONNECTED'); expect(clients[0].interactive).toBe(false);
    expect(clients[0].request).not.toHaveBeenCalledWith('authenticate', expect.anything(), expect.anything());
  });
  it('records authentication failure instead of leaving a stale pending login', async () => {
    await service.start('a'); clients[0].authReject(new Error('failed'));
    await new Promise(resolve => setImmediate(resolve));
    expect(rows.get('a').status).toBe('FAILED');
    (GeminiAcpClient as jest.Mock).mockImplementationOnce(() => ({ initialize: async () => ({}), request: async () => { throw new Error('not authenticated'); }, close: jest.fn() }));
    expect(await service.status('a')).toMatchObject({ connected: false, pending: false, message: expect.stringContaining('확인하지 못') });
  });
  it('does not restore a login disconnected during pending recovery', async () => {
    rows.set('a', { status: 'PENDING', updatedAt: new Date() });
    db.integration.updateMany.mockImplementationOnce(async () => ({ count: 0 }));
    expect(await service.status('a')).toMatchObject({ connected: false });
  });
  it('recovers an authenticated account after a local server startup failure', async () => {
    rows.set('a', { status: 'FAILED', updatedAt: new Date(), metadata: JSON.stringify({ runtime: 'antigravity', connectionError: 'AUTH_FAILED' }) });
    expect(await service.status('a')).toMatchObject({ connected: true, pending: false });
    expect(rows.get('a')).toMatchObject({ status: 'CONNECTED', metadata: JSON.stringify({ runtime: 'antigravity' }) });
    expect(clients[0].interactive).toBe(false);
  });
  it('persists the support termination reason and stops retrying stale pending login', async () => {
    rows.set('a', { status: 'PENDING', updatedAt: new Date() });
    (GeminiAcpClient as jest.Mock).mockImplementationOnce(() => ({ initialize: async () => ({}), request: async () => { throw new AiError(GEMINI_CLIENT_UNSUPPORTED); }, close: jest.fn() }));
    expect(await service.status('a')).toMatchObject({ connected: false, pending: false, migrationRequired: true, message: GEMINI_CLIENT_UNSUPPORTED });
    expect(rows.get('a').status).toBe('FAILED');
    expect(await service.status('a')).toMatchObject({ connected: false, message: expect.stringContaining('Antigravity 방식으로 변경') });
    expect(GeminiAcpClient).toHaveBeenCalledTimes(1);
  });
  it('uses the selected actual model without changing shared preferences', async () => {
    rows.set('a', { status: 'CONNECTED' });
    expect(await service.complete('a', { system: '규칙', prompt: '질문', model: 'model-b' })).toMatchObject({ provider: 'gemini', model: 'model-b', text: 'Gemini 답변', demo: false });
    expect(clients[0].request).toHaveBeenCalledWith('session/set_model', { sessionId: 's1', modelId: 'model-b' }); expect(clients[0].prompt).toHaveBeenCalledWith('s1', '규칙\n\n질문');
    await expect(service.complete('a', { system: '', prompt: '', model: 'invented' })).rejects.toThrow('Gemini 모델');
    expect(db.integration.upsert).not.toHaveBeenCalled();
  });
});

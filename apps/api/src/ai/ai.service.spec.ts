import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { ClaudeCliProvider } from './providers/claude-cli.provider';
import { AiError } from './ai.types';
jest.mock('./providers/claude-cli.provider', () => ({ ClaudeCliProvider: jest.fn() }));
describe('account model selection and per-chat routing', () => {
  let ai: AiService; let saved: string; let db: any; let chatgpt: any; let claude: jest.Mock; let claudeConnected: boolean; let gptConnected: boolean; let claudeDisabled: boolean; let geminiConnected: boolean; let gemini: any;
  const request = { system: 'rules', prompt: 'question' };
  beforeEach(() => {
    saved = 'claude-cli'; claude = jest.fn(); claudeConnected = true; gptConnected = true; claudeDisabled = false; geminiConnected = false;
    db = { integration: { findUnique: jest.fn(async ({ where }) => where.userId_provider.provider === 'CLAUDE_CONNECTION' ? (claudeDisabled ? { status: 'DISCONNECTED' } : null) : where.userId_provider.provider === 'AI_PREFERENCE' ? { metadata: JSON.stringify({ provider: saved }) } : { metadata: JSON.stringify({ model: 'saved-gpt' }) }), upsert: jest.fn(async ({ where, update }) => { if (where.userId_provider.provider === 'CLAUDE_CONNECTION') claudeDisabled = update.status === 'DISCONNECTED'; }) }, aiUsageLog: { create: jest.fn() } };
    chatgpt = { status: jest.fn(async () => ({ connected: gptConnected })), models: jest.fn().mockResolvedValue([{ id: 'gpt-a', name: 'GPT A' }]), complete: jest.fn().mockResolvedValue({ text: 'GPT reply', provider: 'chatgpt', model: 'gpt-a', demo: false }) };
    (ClaudeCliProvider as jest.Mock).mockImplementation(options => ({ name: 'claude-cli', complete: claude.mockImplementation(async () => ({ text: 'Claude reply', provider: 'claude-cli', model: options.model, demo: false })) }));
    gemini = { status: jest.fn(async () => ({ connected: geminiConnected, model: 'gemini-model', message: '' })), models: jest.fn().mockResolvedValue([{ id: 'gemini-model', name: 'Account Gemini model' }]), complete: jest.fn().mockResolvedValue({ text: 'Gemini reply', provider: 'gemini', model: 'gemini-model', demo: false }) };
    ai = new AiService(new ConfigService({ AI_PROVIDER: 'claude-cli', CLAUDE_CLI_MODEL: 'haiku' }), db, undefined, chatgpt, { connection: jest.fn(async () => ({ connected: claudeConnected })) } as any, gemini);
  });
  afterEach(() => jest.clearAllMocks());
  it('shows only Claude models when only Claude is connected', async () => {
    gptConnected = false;
    const catalog = await ai.models('a'); expect(catalog.groups.map(group => group.provider)).toEqual(['claude-cli']); expect(chatgpt.models).not.toHaveBeenCalled();
  });
  it('shows only the account catalog when only ChatGPT is connected', async () => {
    claudeConnected = false; const catalog = await ai.models('a');
    expect(catalog.groups).toEqual([{ provider: 'chatgpt', label: 'ChatGPT', models: [{ id: 'gpt-a', name: 'GPT A' }] }]); expect(chatgpt.models).toHaveBeenCalledWith('a');
  });
  it('automatically shows both connected accounts regardless of the saved preference', async () => {
    expect((await ai.models('a')).groups.map(group => group.provider)).toEqual(['claude-cli', 'chatgpt']);
    chatgpt.models.mockRejectedValue(new Error('disconnected'));
    expect((await ai.models('a')).groups).toMatchObject([{ provider: 'claude-cli' }, { provider: 'chatgpt', models: [], message: expect.any(String) }]);
  });
  it('routes both-mode chat to the chosen service without changing other features', async () => {
    saved = 'both';
    expect(await ai.complete('a', 'assistant:chat', { ...request, provider: 'chatgpt', model: 'gpt-a' })).toMatchObject({ provider: 'chatgpt' });
    expect(chatgpt.complete).toHaveBeenCalledWith('a', expect.objectContaining({ model: 'gpt-a' }));
    expect((await ai.cacheScope('a')).provider).toBe('claude-cli');
    expect(await ai.complete('a', 'news-briefing', request)).toMatchObject({ provider: 'claude-cli', model: 'haiku' });
    expect(db.integration.upsert).not.toHaveBeenCalled();
  });
  it('passes a Claude override for this request while preserving the configured default', async () => {
    expect(await ai.complete('a', 'assistant:chat', { ...request, provider: 'claude-cli', model: 'sonnet' })).toMatchObject({ model: 'sonnet' });
    expect(await ai.complete('a', 'other', request)).toMatchObject({ model: 'haiku' });
  });
  it.each(['claude-cli', 'chatgpt'])('rejects a disconnected service when only %s is connected', async provider => {
    saved = provider;
    claudeConnected = provider === 'claude-cli'; gptConnected = provider === 'chatgpt';
    await expect(ai.complete('a', 'assistant:chat', { ...request, provider: provider === 'chatgpt' ? 'claude-cli' : 'chatgpt' })).rejects.toThrow('연결된 AI');
    expect(chatgpt.complete).not.toHaveBeenCalled(); expect(claude).not.toHaveBeenCalled();
  });
  it('rejects ambiguous model names and unsupported Claude choices', async () => {
    await expect(ai.complete('a', 'assistant:chat', { ...request, model: 'sonnet' })).rejects.toThrow('함께 선택');
    await expect(ai.complete('a', 'assistant:chat', { ...request, provider: 'claude-cli', model: 'unknown' })).rejects.toThrow('Claude 모델');
  });
  it('does not fall back and records the attempted provider after a both-mode failure', async () => {
    saved = 'both'; chatgpt.complete.mockRejectedValue(new AiError('quota', 429));
    await expect(ai.complete('a', 'assistant:chat', { ...request, provider: 'chatgpt', model: 'gpt-a' })).rejects.toThrow('quota');
    expect(claude).not.toHaveBeenCalled(); expect(db.aiUsageLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ provider: 'chatgpt', success: false }) }));
  });
  it('chooses the sole connected account before dispatch and removes disconnected model groups', async () => {
    claudeConnected = false;
    expect((await ai.connections('a')).defaultProvider).toBe('chatgpt');
    expect(await ai.complete('a', 'news', request)).toMatchObject({ provider: 'chatgpt' });
    gptConnected = false;
    expect((await ai.models('a')).groups).toEqual([]);
  });
  it('keeps an app-only Claude disconnection until explicitly reconnected', async () => {
    await ai.disconnectClaude('a');
    expect((await ai.connections('a')).providers).toEqual(['chatgpt']);
    expect((await ai.connections('a')).claude).toMatchObject({ loginConnected: true, connected: false });
    await expect(ai.complete('a', 'chat', { ...request, provider: 'claude-cli' })).rejects.toThrow('연결된 AI');
    gptConnected = false;
    await expect(ai.complete('a', 'chat', request)).rejects.toThrow('AI 계정을 연결');
    expect(claude).not.toHaveBeenCalled();
    await ai.connectClaude('a');
    expect((await ai.connections('a')).providers).toEqual(['claude-cli']);
  });
  it('does not reconnect an app account before the underlying Claude login exists', async () => {
    claudeConnected = false;
    await expect(ai.connectClaude('a')).rejects.toThrow('먼저 Claude');
    expect(db.integration.upsert).not.toHaveBeenCalled();
  });
  it('automatically exposes Gemini models and routes only to the chosen connected service', async () => {
    claudeConnected = false; gptConnected = false; geminiConnected = true;
    expect((await ai.models('a')).groups).toEqual([{ provider: 'gemini', label: 'Gemini', models: [{ id: 'gemini-model', name: 'Account Gemini model' }] }]);
    expect(await ai.complete('a', 'assistant:chat', { ...request, provider: 'gemini', model: 'gemini-model' })).toMatchObject({ provider: 'gemini' });
    expect((await ai.cacheScope('a')).provider).toBe('gemini');
    expect(gemini.complete).toHaveBeenCalledWith('a', expect.objectContaining({ model: 'gemini-model' })); expect(claude).not.toHaveBeenCalled(); expect(chatgpt.complete).not.toHaveBeenCalled();
  });
  it('never switches a failed Gemini request to another connected provider', async () => {
    geminiConnected = true; gemini.complete.mockRejectedValue(new AiError('Gemini quota', 429));
    await expect(ai.complete('a', 'assistant:chat', { ...request, provider: 'gemini' })).rejects.toThrow('Gemini quota');
    expect(claude).not.toHaveBeenCalled(); expect(chatgpt.complete).not.toHaveBeenCalled();
  });
});

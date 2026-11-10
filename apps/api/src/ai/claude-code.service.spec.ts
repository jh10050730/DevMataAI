import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { ClaudeCodeService } from './claude-code.service';
jest.mock('node:child_process', () => ({ execFile: jest.fn() }));
describe('Claude Code installation check', () => {
  beforeEach(() => jest.clearAllMocks());
  it('checks only --version without invoking inference or a shell', async () => {
    (execFile as unknown as jest.Mock).mockImplementation((_path, _args, _options, callback) => callback(null, '2.1.211 (Claude Code)'));
    const result = await new ClaudeCodeService(new ConfigService({ CLAUDE_CLI_PATH: 'C:\\Tools\\claude.exe' })).status();
    expect(result).toMatchObject({ installed: true, version: '2.1.211', loginVerified: false, provider: 'claude-cli' });
    expect(execFile).toHaveBeenCalledWith('C:\\Tools\\claude.exe', ['--version'], expect.objectContaining({ shell: false, windowsHide: true, timeout: 15000, maxBuffer: 16384 }), expect.any(Function));
    const options = (execFile as unknown as jest.Mock).mock.calls[0][2];
    expect(options.env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(options.env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
  });
  it('reports missing installations without leaking process errors', async () => {
    (execFile as unknown as jest.Mock).mockImplementation((_path, _args, _options, callback) => callback({ code: 'ENOENT', message: 'private error' }, ''));
    const result = await new ClaudeCodeService(new ConfigService()).status();
    expect(result).toMatchObject({ installed: false, reason: 'not-found' });
    expect(JSON.stringify(result)).not.toContain('private error');
  });
  it('does not mistake a different executable for Claude or demo for a login test', async () => {
    (execFile as unknown as jest.Mock).mockImplementation((_path, _args, _options, callback) => callback(null, 'different tool 1.2.3'));
    expect(await new ClaudeCodeService(new ConfigService({ AI_PROVIDER: 'demo' })).status()).toMatchObject({ installed: false, provider: 'demo', reason: 'invalid-output', loginVerified: false });
  });
  it('reports timeout as unavailable, not as a verified installation', async () => {
    (execFile as unknown as jest.Mock).mockImplementation((_path, _args, _options, callback) => callback({ killed: true }, ''));
    expect(await new ClaudeCodeService(new ConfigService()).status()).toMatchObject({ installed: false, reason: 'unavailable' });
  });
});

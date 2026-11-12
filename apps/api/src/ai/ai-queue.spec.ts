import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { ClaudeCliProvider } from './providers/claude-cli.provider';
jest.mock('./providers/claude-cli.provider', () => ({ ClaudeCliProvider: jest.fn() }));

/** AI 요청이 겹쳐도 거절하지 않고 차례를 기다린다 (동시에 2개까지 실행) */
describe('AI 요청 대기열', () => {
  const request = { system: 'rules', prompt: 'question' };
  let releases: (() => void)[];
  let running: number; let peak: number;
  let ai: AiService;

  beforeEach(() => {
    releases = []; running = 0; peak = 0;
    const db = { integration: { findUnique: jest.fn(async () => null) }, aiUsageLog: { create: jest.fn() } };
    (ClaudeCliProvider as jest.Mock).mockImplementation(() => ({
      name: 'claude-cli',
      complete: jest.fn(() => new Promise(resolve => {
        running++; peak = Math.max(peak, running);
        releases.push(() => { running--; resolve({ text: 'ok', provider: 'claude-cli', demo: false }); });
      })),
    }));
    ai = new AiService(new ConfigService({ AI_PROVIDER: 'claude-cli' }), db as never, undefined, undefined, { connection: jest.fn(async () => ({ connected: true })) } as never, undefined);
  });

  const flush = () => new Promise(resolve => setImmediate(resolve));

  it('세 번째 요청은 거절되지 않고 앞 요청이 끝나면 실행된다', async () => {
    const calls = [1, 2, 3, 4].map(() => ai.complete('u', 'assistant:chat', request));
    for (let i = 0; i < 5; i++) await flush();
    expect(running).toBe(2);
    releases.shift()!();
    for (let i = 0; i < 5; i++) await flush();
    expect(running).toBe(2);
    while (releases.length) { releases.shift()!(); for (let i = 0; i < 5; i++) await flush(); }
    await expect(Promise.all(calls)).resolves.toHaveLength(4);
    expect(peak).toBe(2);
    expect(running).toBe(0);
  });
});

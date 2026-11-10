import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';

@Injectable()
export class ClaudeCodeService {
  constructor(private readonly config: ConfigService) {}
  async status() {
    const provider = this.config.get<string>('AI_PROVIDER', 'claude-cli');
    const path = this.config.get<string>('CLAUDE_CLI_PATH') || 'claude';
    const base = { provider, path, loginVerified: false, installUrl: 'https://code.claude.com/docs/en/setup' };
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_AUTH_TOKEN;
    return new Promise(resolve => {
      execFile(path, ['--version'], { cwd: tmpdir(), env, windowsHide: true, timeout: 15000, maxBuffer: 16384, shell: false }, (error, stdout) => {
        if (error) { resolve({ ...base, installed: false, reason: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'not-found' : 'unavailable', message: 'Claude Code를 실행할 수 없습니다. 설치 후 앱을 다시 실행해 주세요.' }); return; }
        const version = /\b\d+\.\d+\.\d+(?:-[\w.-]+)?\b/.exec(stdout)?.[0];
        resolve(version && /Claude Code/i.test(stdout)
          ? { ...base, installed: true, version }
          : { ...base, installed: false, reason: 'invalid-output', message: 'Claude Code 버전을 확인하지 못했습니다. 공식 설치 안내를 확인해 주세요.' });
      });
    });
  }
}

import { Injectable, Optional } from '@nestjs/common';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';

@Injectable()
export class ClaudeCodeService {
  private connectionCache?: { path: string; expires: number; promise: Promise<{ connected: boolean; email?: string; message: string; installed: boolean }> };
  constructor(private readonly config: ConfigService, @Optional() private readonly settings?: AppSettingsService) {}
  connection() {
    const path = (this.settings ? this.settings.getEnv('CLAUDE_CLI_PATH') : this.config.get<string>('CLAUDE_CLI_PATH')) || 'claude';
    if (this.connectionCache?.path === path && this.connectionCache.expires > Date.now()) return this.connectionCache.promise;
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_AUTH_TOKEN;
    const promise = new Promise<{ connected: boolean; email?: string; message: string; installed: boolean }>(resolve => {
      execFile(path, ['auth', 'status', '--json'], { cwd: tmpdir(), env, windowsHide: true, timeout: 15000, maxBuffer: 16384, shell: false }, (error, stdout) => {
        try {
          const account = JSON.parse(stdout);
          const connected = !error && account.loggedIn === true && ['claude.ai', 'oauth_token'].includes(account.authMethod);
          resolve({ connected, installed: true, ...(connected && typeof account.email === 'string' ? { email: account.email.slice(0, 320) } : {}), message: connected ? '본인 Claude 계정으로 연결되었습니다.' : 'Claude 계정으로 로그인해 주세요. API 키 연결은 사용하지 않습니다.' });
        } catch {
          resolve({ connected: false, installed: (error as NodeJS.ErrnoException | null)?.code !== 'ENOENT', message: 'Claude 연결 상태를 확인하지 못했습니다. 설치·로그인 상태를 확인하고 다시 시도해 주세요.' });
        }
      });
    });
    this.connectionCache = { path, expires: Date.now() + 10000, promise };
    return promise;
  }
  async status() {
    const provider = (this.settings ? this.settings.getEnv('AI_PROVIDER') : this.config.get<string>('AI_PROVIDER')) || 'claude-cli';
    const path = (this.settings ? this.settings.getEnv('CLAUDE_CLI_PATH') : this.config.get<string>('CLAUDE_CLI_PATH')) || 'claude';
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

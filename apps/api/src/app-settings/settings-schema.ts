import { BadRequestException } from '@nestjs/common';
import { isEmail } from 'class-validator';

type SettingDefinition = { key: string; env: string; label: string; group: string; secret: boolean; kind?: 'port' | 'email' | 'provider' | 'model' | 'url' };
export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  { key: 'google.clientId', env: 'GOOGLE_CLIENT_ID', label: 'Google 클라이언트 ID', group: 'Google', secret: false },
  { key: 'google.clientSecret', env: 'GOOGLE_CLIENT_SECRET', label: 'Google 클라이언트 비밀번호', group: 'Google', secret: true },
  { key: 'google.redirectUri', env: 'GOOGLE_REDIRECT_URI', label: 'Google 콜백 주소', group: 'Google', secret: false, kind: 'url' },
  { key: 'notion.token', env: 'NOTION_TOKEN', label: 'Notion 토큰', group: 'Notion', secret: true },
  { key: 'notion.parentPageId', env: 'NOTION_PARENT_PAGE_ID', label: 'Notion 저장할 페이지 ID', group: 'Notion', secret: false },
  { key: 'github.token', env: 'GITHUB_TOKEN', label: 'GitHub 토큰', group: 'GitHub', secret: true },
  { key: 'smtp.host', env: 'SMTP_HOST', label: '메일 서버 주소', group: '이메일', secret: false },
  { key: 'smtp.port', env: 'SMTP_PORT', label: '메일 서버 포트', group: '이메일', secret: false, kind: 'port' },
  { key: 'smtp.user', env: 'SMTP_USER', label: '메일 로그인 계정', group: '이메일', secret: false },
  { key: 'smtp.password', env: 'SMTP_PASSWORD', label: '메일 앱 비밀번호', group: '이메일', secret: true },
  { key: 'smtp.from', env: 'SMTP_FROM', label: '발신 이메일', group: '이메일', secret: false, kind: 'email' },
  { key: 'ai.provider', env: 'AI_PROVIDER', label: 'AI 제공자', group: 'AI', secret: false, kind: 'provider' },
  { key: 'ai.cliPath', env: 'CLAUDE_CLI_PATH', label: 'Claude Code 실행 경로', group: 'AI', secret: false },
  { key: 'ai.codexPath', env: 'CODEX_CLI_PATH', label: 'ChatGPT 연결 실행 경로', group: 'AI', secret: false },
  { key: 'ai.geminiPath', env: 'ANTIGRAVITY_CLI_PATH', label: 'Gemini 연결 실행 경로 (agy.exe)', group: 'AI', secret: false },
  { key: 'ai.model', env: 'CLAUDE_CLI_MODEL', label: 'Claude 모델', group: 'AI', secret: false, kind: 'model' },
];

/** Validate the complete patch before any database writes; never echo submitted secrets. */
export function validateSettingsPatch(input: unknown): Record<string, string | null> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('설정 항목 형식이 올바르지 않습니다.');
  const output: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(input)) {
    const definition = SETTING_DEFINITIONS.find(row => row.key === key);
    if (!definition) throw new BadRequestException('지원하지 않는 설정 항목입니다.');
    if (value === null) { output[key] = null; continue; }
    if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u001f\u007f]/.test(value)) throw new BadRequestException(`${definition.label} 입력 형식을 확인해 주세요.`);
    const normalized = definition.secret ? value : value.trim();
    const fail = () => { throw new BadRequestException(`${definition.label} 입력 형식을 확인해 주세요.`); };
    if (!normalized && (definition.kind === 'port' || definition.kind === 'provider')) fail();
    if (normalized) {
      if (definition.kind === 'port' && (!/^\d+$/.test(normalized) || +normalized < 1 || +normalized > 65535)) fail();
      if (definition.kind === 'email' && !isEmail(normalized)) fail();
      if (definition.kind === 'provider' && !['claude-cli', 'demo'].includes(normalized)) fail();
      if (definition.kind === 'model' && !/^[\w./:-]{1,200}$/.test(normalized)) fail();
      if (definition.kind === 'url') {
        try {
          const url = new URL(normalized);
          if (url.username || url.password || !['http:', 'https:'].includes(url.protocol) || (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) fail();
        } catch { fail(); }
      }
    }
    output[key] = normalized;
  }
  return output;
}

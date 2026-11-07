export const AI_PROVIDERS = ['claude-cli', 'anthropic-api', 'demo'] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

/** 서버 시작 시 필수 환경변수 검증. 값은 로그에 출력하지 않는다. */
export function validateEnv(config: Record<string, unknown>) {
  const errors: string[] = [];

  if (!config.DATABASE_URL) errors.push('DATABASE_URL 이 필요합니다.');

  const secret = String(config.JWT_SECRET ?? '');
  if (secret.length < 32 || secret === 'change-me-to-a-long-random-string') {
    errors.push('JWT_SECRET 은 32자 이상의 무작위 값이어야 합니다.');
  }

  const provider = String(config.AI_PROVIDER ?? 'claude-cli');
  if (!AI_PROVIDERS.includes(provider as AiProviderName)) {
    errors.push(`AI_PROVIDER 는 ${AI_PROVIDERS.join(' | ')} 중 하나여야 합니다.`);
  }

  if (errors.length) {
    throw new Error(`환경변수 오류 (apps/api/.env 확인):\n- ${errors.join('\n- ')}`);
  }
  return config;
}

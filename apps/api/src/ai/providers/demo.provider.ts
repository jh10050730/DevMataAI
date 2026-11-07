import { AiProvider, AiRequest, AiResult } from '../ai.types';

/**
 * AI 없이 앱을 테스트하기 위한 데모 프로바이더.
 * 내용을 지어내지 않고, 데모 응답임을 명확히 밝힌다.
 */
export class DemoProvider implements AiProvider {
  readonly name = 'demo';

  async available() {
    return { ok: true, detail: '데모 모드 — 실제 AI를 호출하지 않습니다.' };
  }

  async complete({ prompt }: AiRequest): Promise<AiResult> {
    const preview = prompt.replace(/\s+/g, ' ').slice(0, 160);
    return {
      text: [
        '> ⚠️ **데모 응답입니다.** 실제 AI가 생성한 내용이 아닙니다.',
        '> `apps/api/.env` 에서 `AI_PROVIDER=claude-cli` 로 설정하면 이 PC의 Claude Code 로 응답합니다.',
        '',
        `요청 미리보기: ${preview}${prompt.length > 160 ? '…' : ''}`,
      ].join('\n'),
      provider: this.name,
      demo: true,
    };
  }
}

export interface AiRequest {
  system: string;
  prompt: string;
}

export interface AiResult {
  text: string;
  provider: string;
  model?: string;
  /** 데모 응답이면 true — 화면에서 실제 AI 응답과 구분 표시 */
  demo: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiProvider {
  readonly name: string;
  /** 설정상 사용 가능한지 (실제 호출 성공 여부와는 별개) */
  available(): Promise<{ ok: boolean; detail: string }>;
  complete(req: AiRequest): Promise<AiResult>;
}

/** 사용자에게 보여줘도 되는 AI 오류 */
export class AiError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}

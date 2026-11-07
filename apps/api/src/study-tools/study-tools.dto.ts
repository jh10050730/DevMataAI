import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export const STUDY_AI_ACTIONS = ['summary', 'explain', 'terms', 'quiz-choice', 'quiz-short', 'ask'] as const;
export type StudyAiAction = (typeof STUDY_AI_ACTIONS)[number];

export class StudyAiRequestDto {
  @IsIn(STUDY_AI_ACTIONS)
  action: StudyAiAction;

  /** ask 에서는 필수, explain 에서는 설명받을 개념(선택) */
  @ValidateIf((o) => o.action === 'ask' || o.question !== undefined)
  @IsString()
  @MinLength(1, { message: '질문을 입력해주세요.' })
  @MaxLength(500)
  question?: string;
}

export class NotionImportRequestDto {
  @IsString()
  @MinLength(32, { message: 'Notion 페이지 링크 또는 ID를 입력해주세요.' })
  @MaxLength(500)
  page: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subjectId?: string;
}

export class NotionExportRequestDto {
  /** 이미 연결된 Notion 페이지의 본문을 덮어쓰는 것에 사용자가 동의했는지 */
  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}

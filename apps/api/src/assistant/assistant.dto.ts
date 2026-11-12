import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsISO8601, IsString, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { CATEGORIES, TASK_PRIORITIES } from '../common/constants';
import { REPEATS } from '../common/recurrence';
const optional = (_: unknown, value: unknown) => value !== undefined;
class ChatMessage {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant';
  @IsString() @MaxLength(4000) content!: string;
}
export class ChatDto {
  @IsString() @MinLength(1) @MaxLength(2000) message!: string;
  @ValidateIf(optional) @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => ChatMessage) history?: ChatMessage[];
  @ValidateIf(optional) @IsIn(['claude-cli', 'chatgpt', 'gemini']) provider?: 'claude-cli' | 'chatgpt' | 'gemini';
  @ValidateIf(optional) @IsString() @MinLength(1) @MaxLength(200) model?: string;
  /** 사용자가 지금 보고 있는 화면 주소 (예: /study?note=…). 오른쪽 AI 패널에서 보낸다 */
  @ValidateIf(optional) @IsString() @MaxLength(300) page?: string;
}
export class SearchDto { @IsString() @MinLength(1) @MaxLength(100) q!: string; }
/** 빠른 입력 (단축키 창): 한 줄을 할 일·일정·메모 제안으로 바꾼다 */
export class QuickDto { @IsString() @MinLength(1) @MaxLength(500) text!: string; }
export const ACTION_KINDS = ['task_create', 'task_update', 'task_complete', 'task_rename', 'task_delete', 'event_create', 'event_update', 'event_delete', 'note_create', 'note_update', 'note_delete', 'project_create', 'project_update', 'project_delete', 'item_create', 'item_update', 'item_delete'] as const;
export const PROJECT_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED'];
export const ITEM_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
export class ActionDto {
  @IsIn(ACTION_KINDS) kind!: typeof ACTION_KINDS[number];
  @IsString() @MinLength(1) @MaxLength(100) targetId!: string;
  @ValidateIf(optional) @IsString() @MinLength(1) @MaxLength(200) title?: string;
  // 프로젝트 생성·수정
  @ValidateIf(optional) @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @ValidateIf(optional) @IsString() @MaxLength(2000) goal?: string;
  @ValidateIf(optional) @IsString() @MaxLength(10000) description?: string;
  // 프로젝트 상태(ACTIVE·PAUSED·COMPLETED) 또는 작업 상태(TODO·IN_PROGRESS·BLOCKED·DONE)
  @ValidateIf(optional) @IsIn([...PROJECT_STATUSES, ...ITEM_STATUSES]) status?: string;
  // 작업 추가
  @ValidateIf(optional) @IsIn(['TASK', 'FEATURE']) itemKind?: string;
  @ValidateIf(optional) @IsString() @MaxLength(5000) notes?: string;
  // 일정 추가: 시간대가 포함된 ISO 문자열. 서비스에서도 모델 출력을 재검증한다.
  @ValidateIf(optional) @IsString() @MaxLength(50) @IsISO8601({ strict: true }) startAt?: string;
  @ValidateIf(optional) @IsString() @MaxLength(50) @IsISO8601({ strict: true }) endAt?: string;
  @ValidateIf(optional) @IsBoolean() allDay?: boolean;
  @ValidateIf(optional) @IsString() @MaxLength(200) location?: string;
  // 할 일 추가·수정. dueDate 는 시간대가 포함된 ISO 문자열, 빈 문자열이면 마감일 지우기
  @ValidateIf(optional) @IsIn(TASK_PRIORITIES) priority?: string;
  @ValidateIf(optional) @IsIn(CATEGORIES) category?: string;
  @ValidateIf(optional) @IsString() @MaxLength(50) dueDate?: string;
  @ValidateIf(optional) @IsBoolean() completed?: boolean;
  // 할 일·일정 반복 (할 일은 마감일 필요)
  @ValidateIf(optional) @IsIn(REPEATS) repeat?: string;
  // 학습 노트 추가·수정. content 는 본문 전체 교체, appendContent 는 본문 끝에 덧붙이기
  @ValidateIf(optional) @IsString() @MaxLength(50000) content?: string;
  @ValidateIf(optional) @IsString() @MaxLength(20000) appendContent?: string;
  @ValidateIf(optional) @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) tags?: string[];
}

import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
const optional = (_: unknown, value: unknown) => value !== undefined;
class ChatMessage {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant';
  @IsString() @MaxLength(4000) content!: string;
}
export class ChatDto {
  @IsString() @MinLength(1) @MaxLength(2000) message!: string;
  @ValidateIf(optional) @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => ChatMessage) history?: ChatMessage[];
}
export class SearchDto { @IsString() @MinLength(1) @MaxLength(100) q!: string; }
export const ACTION_KINDS = ['task_complete', 'task_rename', 'task_delete', 'event_delete', 'note_delete', 'project_create', 'project_update', 'project_delete', 'item_create', 'item_update', 'item_delete'] as const;
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
}

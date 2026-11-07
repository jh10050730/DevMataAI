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
export const ACTION_KINDS = ['task_complete', 'task_rename', 'task_delete', 'event_delete', 'note_delete', 'project_delete'] as const;
export class ActionDto {
  @IsIn(ACTION_KINDS) kind!: typeof ACTION_KINDS[number];
  @IsString() @MinLength(1) @MaxLength(100) targetId!: string;
  @ValidateIf(optional) @IsString() @MinLength(1) @MaxLength(200) title?: string;
}

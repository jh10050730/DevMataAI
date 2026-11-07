import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CATEGORIES, TASK_PRIORITIES } from '../common/constants';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTaskDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: '제목을 입력해주세요.' })
  @MaxLength(200)
  title: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsOptional() @IsIn(TASK_PRIORITIES)
  priority?: string;

  @IsOptional() @IsIn(CATEGORIES)
  category?: string;

  @IsOptional() @Type(() => Date) @IsDate({ message: '마감일 형식이 올바르지 않습니다.' })
  dueDate?: Date;
}

export class UpdateTaskDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(200)
  title?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(5000)
  description?: string | null;

  @IsOptional() @IsIn(TASK_PRIORITIES)
  priority?: string;

  @IsOptional() @IsIn(CATEGORIES)
  category?: string;

  /** null 이면 마감일 제거 */
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Date) @IsDate()
  dueDate?: Date | null;

  @IsOptional() @IsBoolean()
  completed?: boolean;
}

export class TaskQueryDto {
  @IsOptional() @IsIn(['all', 'active', 'completed'])
  status?: 'all' | 'active' | 'completed';

  @IsOptional() @IsIn(CATEGORIES)
  category?: string;
}

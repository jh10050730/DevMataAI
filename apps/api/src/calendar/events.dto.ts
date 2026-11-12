import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsHexColor, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CATEGORIES } from '../common/constants';
import { REPEATS } from '../common/recurrence';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateEventDto {
  @Transform(trim) @IsString() @MinLength(1, { message: '제목을 입력해주세요.' }) @MaxLength(200)
  title: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(200)
  location?: string;

  @Type(() => Date) @IsDate({ message: '시작 시간 형식이 올바르지 않습니다.' })
  startAt: Date;

  @Type(() => Date) @IsDate({ message: '종료 시간 형식이 올바르지 않습니다.' })
  endAt: Date;

  @IsOptional() @IsBoolean()
  allDay?: boolean;

  @IsOptional() @IsHexColor()
  color?: string;

  @IsOptional() @IsIn(CATEGORIES)
  category?: string;

  /** 반복 (한국 시간 달력 기준). 없으면 한 번만 */
  @IsOptional() @IsIn(REPEATS)
  repeat?: string;

  /** 반복 끝: 이 시각 뒤에 시작하는 회차는 없음 */
  @IsOptional() @Type(() => Date) @IsDate()
  repeatUntil?: Date;
}

export class UpdateEventDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(200)
  title?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(5000)
  description?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(200)
  location?: string | null;

  @IsOptional() @Type(() => Date) @IsDate()
  startAt?: Date;

  @IsOptional() @Type(() => Date) @IsDate()
  endAt?: Date;

  @IsOptional() @IsBoolean()
  allDay?: boolean;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsHexColor()
  color?: string | null;

  @IsOptional() @IsIn(CATEGORIES)
  category?: string;

  /** null 이면 반복 끄기 */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(REPEATS)
  repeat?: string | null;

  /** null 이면 끝 없이 반복 */
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Date) @IsDate()
  repeatUntil?: Date | null;
}

export class EventRangeDto {
  @Type(() => Date) @IsDate({ message: 'from 날짜가 필요합니다.' })
  from: Date;

  @Type(() => Date) @IsDate({ message: 'to 날짜가 필요합니다.' })
  to: Date;
}

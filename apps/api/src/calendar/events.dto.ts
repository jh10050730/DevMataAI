import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsHexColor, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CATEGORIES } from '../common/constants';

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
}

export class EventRangeDto {
  @Type(() => Date) @IsDate({ message: 'from 날짜가 필요합니다.' })
  from: Date;

  @Type(() => Date) @IsDate({ message: 'to 날짜가 필요합니다.' })
  to: Date;
}

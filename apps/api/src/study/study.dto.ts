import { ArrayMaxSize, ArrayUnique, IsArray, IsHexColor, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SubjectDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @IsHexColor() color?: string;
}
export class StudyQueryDto {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsString() @MaxLength(100) subjectId?: string;
  @IsOptional() @IsString() @MaxLength(40) tag?: string;
  @IsOptional() @IsIn(['true', 'false']) due?: string;
}
export class CreateNoteDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(50000) content?: string;
  @IsOptional() @IsString() @MaxLength(100) subjectId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsString({ each: true }) @MaxLength(40, { each: true }) tags?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
}
export class UpdateNoteDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(50000) content?: string;
  @IsOptional() @IsString() @MaxLength(100) subjectId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsString({ each: true }) @MaxLength(40, { each: true }) tags?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
}
export class StudySessionDto {
  @IsIn(['again', 'hard', 'good', 'easy']) rating!: 'again' | 'hard' | 'good' | 'easy';
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
}
export class StudyAiDto {
  @IsIn(['summary', 'explain', 'terms', 'quiz-choice', 'quiz-short']) action!: string;
  @IsOptional() @IsString() @MaxLength(500) question?: string;
}
export class NotionImportDto {
  @IsString() @MinLength(32) @MaxLength(500) page!: string;
  @IsOptional() @IsString() subjectId?: string;
}

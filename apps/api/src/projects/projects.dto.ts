import { IsIn, IsString, MaxLength, MinLength, Matches, ValidateIf } from 'class-validator';
const optional = (_: unknown, value: unknown) => value !== undefined;
export class CreateProjectDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @ValidateIf(optional) @IsString() @MaxLength(2000) goal?: string;
  @ValidateIf(optional) @IsString() @MaxLength(10000) description?: string;
  @ValidateIf(optional) @IsString() @Matches(/^(?:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)?$/) @MaxLength(200) repository?: string;
  @ValidateIf(optional) @IsString() @MaxLength(500) localPath?: string;
}
export class UpdateProjectDto {
  @ValidateIf(optional) @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @ValidateIf(optional) @IsString() @MaxLength(2000) goal?: string;
  @ValidateIf(optional) @IsString() @MaxLength(10000) description?: string;
  @ValidateIf(optional) @IsString() @Matches(/^(?:[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)?$/) @MaxLength(200) repository?: string;
  @ValidateIf(optional) @IsString() @MaxLength(500) localPath?: string;
  @ValidateIf(optional) @IsIn(['ACTIVE', 'PAUSED', 'COMPLETED']) status?: string;
}
export class CreateProjectItemDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @ValidateIf(optional) @IsIn(['TASK', 'FEATURE']) kind?: string;
  @ValidateIf(optional) @IsString() @MaxLength(5000) notes?: string;
}
export class UpdateProjectItemDto {
  @ValidateIf(optional) @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @ValidateIf(optional) @IsIn(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']) status?: string;
  @ValidateIf(optional) @IsString() @MaxLength(5000) notes?: string;
}
export class FileQueryDto {
  @IsIn(['local', 'github']) source!: string;
  @ValidateIf(optional) @IsString() @MinLength(1) @MaxLength(500) path?: string;
}

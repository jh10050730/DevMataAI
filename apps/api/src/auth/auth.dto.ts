import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { NoEmailDomainTypo } from './email-domain';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterDto {
  @NoEmailDomainTypo()
  @Transform(trimLower)
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  @MaxLength(254)
  email: string;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: '이름을 입력해주세요.' })
  @MaxLength(50)
  name: string;

  @IsString()
  @MinLength(6, { message: '비밀번호는 6자 이상이어야 합니다.' })
  @MaxLength(72, { message: '비밀번호는 72자 이하여야 합니다.' }) // bcrypt 한계
  password: string;
}

export class ForgotPasswordDto {
  @Transform(trimLower)
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  @MaxLength(254)
  @NoEmailDomainTypo()
  email: string;
}
export class ResetPasswordDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/, { message: '유효하지 않은 재설정 링크입니다.' })
  token: string;
  @IsString() @MinLength(6, { message: '비밀번호는 6자 이상이어야 합니다.' }) @MaxLength(72)
  password: string;
  @IsString() @MinLength(6, { message: '비밀번호는 6자 이상이어야 합니다.' }) @MaxLength(72)
  passwordConfirmation: string;
}

export class LoginDto {
  @Transform(trimLower)
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  @MinLength(1, { message: '비밀번호를 입력해주세요.' })
  @MaxLength(72)
  password: string;
}

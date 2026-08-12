import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsOptional()
  oldPassword?: string;

  @IsString()
  @IsOptional()
  currentPassword?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;

  /**
   * Returns the effective old password value.
   * Frontend sends "currentPassword", DTO originally used "oldPassword".
   */
  get effectiveOldPassword(): string {
    return this.oldPassword || this.currentPassword || '';
  }
}

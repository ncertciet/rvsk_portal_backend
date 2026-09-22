import { IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';

/**
 * RVSK-USR-MGMT-001.5 — My Profile update. Phone + Contact Email are
 * mandatory in the UI; here they are optional (partial update) but must be
 * valid when present. Email fields are format-validated server-side.
 */
export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  displayName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(15)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(15)
  mobileNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  designation?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  department?: string;

  @IsEmail({}, { message: 'userEmail must be a valid email address' })
  @IsOptional()
  @MaxLength(255)
  userEmail?: string;

  @IsEmail({}, { message: 'contactEmail must be a valid email address' })
  @IsOptional()
  @MaxLength(255)
  contactEmail?: string;
}

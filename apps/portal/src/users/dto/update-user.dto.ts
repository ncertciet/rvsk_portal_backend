import {
  IsOptional,
  IsString,
  IsEmail,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * RVSK-USR-MGMT-001.7 #4 — Admin edit user. Same field set as create
 * (minus username, which is immutable). Geo scope carried as *_key; names
 * are resolved server-side. Role-conditional + chain rules enforced in the
 * service.
 */
export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  displayName?: string;

  @IsString()
  @IsOptional()
  role?: string;

  // ── Geographic scope (view-sourced keys) ──
  @IsString()
  @IsOptional()
  @Matches(/^\d+$/, { message: 'stateKey must be a numeric key' })
  stateKey?: string | null;

  @IsString()
  @IsOptional()
  @Matches(/^\d+$/, { message: 'districtKey must be a numeric key' })
  districtKey?: string | null;

  @IsString()
  @IsOptional()
  @Matches(/^\d+$/, { message: 'blockKey must be a numeric key' })
  blockKey?: string | null;

  // ── Contact details ──
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

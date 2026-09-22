import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * RVSK-USR-MGMT-001.4 — Create User payload.
 *
 * - `username` is a login identifier that MAY be an email OR a plain string;
 *   it is NOT strictly email-validated (spec .4 #3).
 * - `contactEmail` is mandatory; `userEmail` optional. Both, when present,
 *   must be valid email format (spec .4 #5).
 * - Geo scope is carried as *_key (bigint as string). Role-conditional
 *   requirement + chain consistency are enforced server-side in the service
 *   (spec .2 / .8), not by static decorators, because they are cross-field
 *   and role-dependent.
 */
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  // ── Geographic scope (view-sourced keys; names resolved server-side) ──
  @IsString()
  @IsOptional()
  @Matches(/^\d+$/, { message: 'stateKey must be a numeric key' })
  stateKey?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d+$/, { message: 'districtKey must be a numeric key' })
  districtKey?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d+$/, { message: 'blockKey must be a numeric key' })
  blockKey?: string;

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
  @IsNotEmpty({ message: 'contactEmail is required' })
  @MaxLength(255)
  contactEmail: string;
}

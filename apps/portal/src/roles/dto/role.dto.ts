import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * RVSK-RBAC-ROLE-002-A — Roles API DTOs.
 *
 * role_code is the stable authorization key: it must match the same convention
 * used everywhere else (`@Roles('...')`, JWT claim, role_page_defaults_v2), i.e.
 * alphanumeric + underscore, e.g. 'RVSK_SPOC'.
 */

const ROLE_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{1,49}$/;

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(ROLE_CODE_PATTERN, {
    message:
      'roleCode must start with a letter and contain only letters, digits, or underscores (max 50 chars)',
  })
  roleCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  roleName: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  roleName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class RoleDto {
  id: string;
  roleCode: string;
  roleName: string;
  description: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

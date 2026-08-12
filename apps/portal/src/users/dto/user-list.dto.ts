/**
 * Response DTO for user list items — excludes password hash and sensitive fields.
 */
export class UserListDto {
  id: string;
  username: string;
  displayName: string;
  role: string;
  stateCode: string;
  districtCode: string | null = null;
  isActive: boolean;
  lastLoginAt: Date | null = null;
}

/**
 * Response DTO for user creation — includes the auto-generated temp password.
 */
export class CreateUserResponseDto {
  success: boolean;
  message: string;
  user: UserListDto;
  tempPassword: string;
}

/**
 * Profile response DTO for getUserById — includes extended profile fields.
 */
export class UserProfileDto {
  id: string;
  username: string;
  displayName: string;
  role: string;
  stateCode: string;
  districtCode: string | null = null;
  phone: string | null = null;
  designation: string | null = null;
  department: string | null = null;
  isActive: boolean;
  isFirstLogin: boolean;
  lastLoginAt: Date | null = null;
  passwordChangedAt: Date | null = null;
  createdAt: Date | null = null;
}

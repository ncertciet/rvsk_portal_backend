/**
 * Response DTO for user list items — excludes password hash and sensitive fields.
 * Geo scope exposed as *_key (bigint as string) + *_name display snapshots.
 */
export class UserListDto {
  id: string;
  username: string;
  displayName: string;
  role: string;
  stateKey: string | null = null;
  stateName: string | null = null;
  districtKey: string | null = null;
  districtName: string | null = null;
  blockKey: string | null = null;
  blockName: string | null = null;
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
 * Profile response DTO for getUserById — includes extended profile fields
 * so the AdminEditUser form can pre-fill and pre-select the geo cascade.
 */
export class UserProfileDto {
  id: string;
  username: string;
  displayName: string;
  role: string;
  stateKey: string | null = null;
  stateName: string | null = null;
  districtKey: string | null = null;
  districtName: string | null = null;
  blockKey: string | null = null;
  blockName: string | null = null;
  clusterKey: string | null = null;
  clusterName: string | null = null;
  udiseCode: string | null = null;
  schoolName: string | null = null;
  phone: string | null = null;
  mobileNumber: string | null = null;
  designation: string | null = null;
  department: string | null = null;
  userEmail: string | null = null;
  contactEmail: string | null = null;
  isActive: boolean;
  isFirstLogin: boolean;
  lastLoginAt: Date | null = null;
  passwordChangedAt: Date | null = null;
  createdAt: Date | null = null;
}

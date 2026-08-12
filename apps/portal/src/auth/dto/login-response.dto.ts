export class LoginResponseUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  stateCode: string;
  districtCode: string | null = null;
  isActive: boolean;
  lastLoginAt: Date | null = null;
}

export class LoginResponse {
  success: boolean;
  message: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  firstLogin: boolean;
  user: LoginResponseUser;
  access: Record<string, string[]>;
}

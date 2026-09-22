export class LoginResponseUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  /** Legacy 2-char state code (state_id) for backward-compatible UIs (e.g. VSK). */
  stateCode: string | null = null;
  stateKey: string | null = null;
  stateName: string | null = null;
  districtKey: string | null = null;
  districtName: string | null = null;
  blockKey: string | null = null;
  blockName: string | null = null;
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

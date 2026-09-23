import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import * as bcrypt from 'bcrypt';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { AppException } from '@rvsk/common';

// HTTP 423 Locked is not in all NestJS HttpStatus versions
const HTTP_LOCKED = 423 as HttpStatus;

import { PortalUser } from './entities/portal-user.entity';
import { TokenService } from './jwt.service';
import { PermissionServiceV2 } from '../rbac/permission.service';
import { NotificationService } from '../notification/notification.service';
import {
  LoginDto,
  LoginResponse,
  LoginResponseUser,
  RefreshTokenDto,
  ChangePasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto';

export interface UserResponse {
  id: string;
  username: string;
  displayName: string;
  role: string;
  stateKey: string | null;
  stateName: string | null;
  districtKey: string | null;
  districtName: string | null;
  blockKey: string | null;
  blockName: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
}

export interface ProfileResponse {
  id: string;
  username: string;
  displayName: string;
  role: string;
  stateKey: string | null;
  stateName: string | null;
  districtKey: string | null;
  districtName: string | null;
  blockKey: string | null;
  blockName: string | null;
  phone: string;
  designation: string;
  department: string;
  userEmail: string;
  contactEmail: string;
  mobileNumber: string;
  isActive: boolean;
  lastLoginAt: Date | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxFailedAttempts: number;
  private readonly lockoutDurationMinutes: number;
  private readonly bcryptStrength: number;
  private readonly externalAuthUrl: string;

  constructor(
    @InjectRepository(PortalUser)
    private readonly userRepo: Repository<PortalUser>,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly permissionServiceV2: PermissionServiceV2,
    private readonly notificationService: NotificationService,
  ) {
    this.maxFailedAttempts = parseInt(String(this.configService.get('MAX_FAILED_ATTEMPTS', 5)), 10) || 5;
    this.lockoutDurationMinutes = parseInt(String(this.configService.get('LOCKOUT_DURATION_MINUTES', 15)), 10) || 15;
    // bcrypt needs a numeric salt-rounds value; env values arrive as strings.
    const rounds = parseInt(String(this.configService.get('BCRYPT_STRENGTH', 12)), 10);
    this.bcryptStrength = Number.isNaN(rounds) ? 12 : rounds;
    this.externalAuthUrl = this.configService.get<string>('EXTERNAL_AUTH_URL', '');
  }

  // ==================== LOGIN (Dual-mode) ====================

  /**
   * Dual-mode login:
   * 1. If user has password_hash → authenticate locally (bcrypt verify)
   * 2. If user has no password_hash → fall back to external auth proxy
   * 3. On success → issue self-signed JWT tokens
   */
  async login(request: LoginDto): Promise<LoginResponse> {
    this.logger.log(`Login attempt for user: ${request.username}`);

    // Step 1: Find user by username
    const user = await this.userRepo.findOne({
      where: { username: request.username },
    });

    if (!user) {
      this.logger.warn(`Login attempt for non-existent user: ${request.username}`);
      throw new AppException(
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
        'AUTH_FAILED',
      );
    }

    // Step 2: Check if account is active
    if (!user.isActive) {
      this.logger.warn(`Login attempt for deactivated user: ${request.username}`);
      throw new AppException(
        'Account is deactivated. Contact administrator.',
        HttpStatus.FORBIDDEN,
        'ACCOUNT_INACTIVE',
      );
    }

    // Step 3: Check account lockout
    if (this.isAccountLocked(user)) {
      this.logger.warn(`Login attempt for locked account: ${request.username}`);
      throw new AppException(
        'Account is temporarily locked due to too many failed attempts. Try again later.',
        HTTP_LOCKED,
        'ACCOUNT_LOCKED',
      );
    }

    // Step 4/5: Dual-mode authentication
    if (user.passwordHash && user.passwordHash.trim() !== '') {
      // LOCAL authentication
      return this.authenticateLocally(user, request.password);
    } else {
      // EXTERNAL authentication (fallback)
      return this.authenticateExternally(user, request.username, request.password);
    }
  }

  // ==================== REFRESH TOKEN ====================

  /**
   * Refresh access token using a valid refresh token.
   */
  async refreshToken(request: RefreshTokenDto): Promise<LoginResponse> {
    const { refreshToken } = request;

    // Validate it's a refresh token
    if (!this.tokenService.isRefreshToken(refreshToken)) {
      throw new AppException(
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
        'INVALID_REFRESH_TOKEN',
      );
    }

    // Validate token is not expired
    if (this.tokenService.isTokenExpired(refreshToken)) {
      throw new AppException(
        'Refresh token expired. Please login again.',
        HttpStatus.UNAUTHORIZED,
        'REFRESH_TOKEN_EXPIRED',
      );
    }

    // Validate token signature and claims
    const payload = this.tokenService.validateToken(refreshToken);
    if (payload.token_type !== 'refresh') {
      throw new AppException(
        'Invalid token type',
        HttpStatus.UNAUTHORIZED,
        'INVALID_TOKEN_TYPE',
      );
    }

    const username = payload.sub as string;
    const user = await this.userRepo.findOne({ where: { username } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.UNAUTHORIZED,
        'USER_NOT_FOUND',
      );
    }

    if (!user.isActive) {
      throw new AppException(
        'Account is deactivated',
        HttpStatus.FORBIDDEN,
        'ACCOUNT_INACTIVE',
      );
    }

    // Resolve access map
    const access = await this.permissionServiceV2.getResolvedAccess(user.id, user.role);

    // Generate new access token
    const legacyStateCode = await this.resolveLegacyStateCode(user);
    const newAccessToken = this.tokenService.generateAccessToken(user, access, legacyStateCode);

    return {
      success: true,
      message: 'Token refreshed',
      accessToken: newAccessToken,
      refreshToken,
      tokenType: 'Bearer',
      firstLogin: false,
      user: this.toLoginResponseUser(user, legacyStateCode),
      access,
    };
  }

  // ==================== CHANGE PASSWORD ====================

  /**
   * Change password for the currently authenticated user.
   */
  async changePassword(
    username: string,
    dto: ChangePasswordDto,
    skipOldPasswordCheck = false,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { username } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    if (!user.passwordHash || user.passwordHash.trim() === '') {
      throw new AppException(
        'Cannot change password for externally authenticated users',
        HttpStatus.BAD_REQUEST,
        'EXTERNAL_AUTH_USER',
      );
    }

    // First-login bypass: on the initial profile-completion flow the user has
    // not chosen a password yet, so the current-password check is skipped.
    // Otherwise the current password must match.
    if (!skipOldPasswordCheck) {
      const oldPassword = dto.effectiveOldPassword;
      const isMatch = oldPassword
        ? await bcrypt.compare(oldPassword, user.passwordHash)
        : false;
      if (!isMatch) {
        throw new AppException(
          'Current password is incorrect',
          HttpStatus.BAD_REQUEST,
          'INVALID_CURRENT_PASSWORD',
        );
      }
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptStrength);
    user.passwordChangedAt = new Date();
    user.isFirstLogin = false;
    await this.userRepo.save(user);

    this.logger.log(`Password changed for user: ${username}`);

    // RVSK-NOTIFY-EMAIL-003: PASSWORD_CHANGED (self-service confirmation).
    await this.notifyUser('PASSWORD_CHANGED', user);
  }

  // ==================== RESET PASSWORD (Admin) ====================

  /**
   * Admin resets a user's password.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptStrength);
    user.failedAttempts = 0;
    user.lockedUntil = null;
    await this.userRepo.save(user);

    this.logger.log(`Password reset by admin for user: ${user.username}`);

    // RVSK-NOTIFY-EMAIL-003: PASSWORD_RESET (admin-initiated by Super/RVSK Admin).
    await this.notifyUser('PASSWORD_RESET', user);
  }

  // ==================== LOGOUT ====================

  /**
   * Logout: placeholder for JWT stateless architecture.
   * In a stateless JWT system, there's no server-side session to invalidate.
   */
  async logout(username: string): Promise<void> {
    this.logger.log(`Logout for user: ${username}`);
    // JWT is stateless — no server-side invalidation needed
    // If token blacklisting is implemented later, it would go here
  }

  // ==================== GET CURRENT USER ====================

  /**
   * Get current user profile from portal_users.
   */
  async getCurrentUser(username: string): Promise<UserResponse> {
    const user = await this.userRepo.findOne({ where: { username } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    return this.toUserResponse(user);
  }

  // ==================== GET PROFILE ====================

  /**
   * Get detailed user profile.
   */
  async getProfile(username: string): Promise<ProfileResponse> {
    const user = await this.userRepo.findOne({ where: { username } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    return this.toProfileResponse(user);
  }

  // ==================== UPDATE PROFILE ====================

  /**
   * Update user profile fields.
   */
  async updateProfile(username: string, dto: UpdateProfileDto): Promise<ProfileResponse> {
    const user = await this.userRepo.findOne({ where: { username } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    // Reject a contact email already used by a different user, with a clear
    // message (instead of a generic failure).
    if (dto.contactEmail !== undefined && dto.contactEmail !== null && dto.contactEmail !== '') {
      await this.assertContactEmailAvailable(dto.contactEmail, user.id);
    }

    if (dto.displayName !== undefined) user.displayName = dto.displayName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.designation !== undefined) user.designation = dto.designation;
    if (dto.department !== undefined) user.department = dto.department;
    if (dto.userEmail !== undefined) user.userEmail = dto.userEmail;
    if (dto.contactEmail !== undefined) user.contactEmail = dto.contactEmail;
    if (dto.mobileNumber !== undefined) user.mobileNumber = dto.mobileNumber;

    await this.userRepo.save(user);
    this.logger.log(`Profile updated for user: ${username}`);

    return this.toProfileResponse(user);
  }

  /**
   * Throws a clear 409 if the given contact email is already used by a
   * different user. Case-insensitive. `excludeUserId` skips the current user
   * so re-saving their own email is allowed.
   */
  private async assertContactEmailAvailable(
    contactEmail: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existing = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.contactEmail) = LOWER(:email)', { email: contactEmail.trim() })
      .getMany();
    const clash = existing.some((u) => u.id !== excludeUserId);
    if (clash) {
      throw new AppException(
        'This contact email is already registered to another user. Please use a different email.',
        HttpStatus.CONFLICT,
        'CONTACT_EMAIL_EXISTS',
      );
    }
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Local authentication using bcrypt password comparison.
   */
  private async authenticateLocally(user: PortalUser, rawPassword: string): Promise<LoginResponse> {
    const isMatch = await bcrypt.compare(rawPassword, user.passwordHash);

    if (!isMatch) {
      await this.handleFailedAttempt(user);
      throw new AppException(
        'Invalid credentials',
        HttpStatus.UNAUTHORIZED,
        'AUTH_FAILED',
      );
    }

    // Successful login — reset failed attempts
    this.resetFailedAttempts(user);
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    // Resolve access map
    const access = await this.permissionServiceV2.getResolvedAccess(user.id, user.role);

    // Generate tokens
    const legacyStateCode = await this.resolveLegacyStateCode(user);
    const accessToken = this.tokenService.generateAccessToken(user, access, legacyStateCode);
    const refreshToken = this.tokenService.generateRefreshToken(user);

    this.logger.log(
      `Local login successful for user: ${user.username} with role: ${user.role}`,
    );

    return {
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      firstLogin: user.isFirstLogin === true,
      user: this.toLoginResponseUser(user, legacyStateCode),
      access,
    };
  }

  /**
   * External authentication by proxying credentials to EXTERNAL_AUTH_URL.
   */
  private async authenticateExternally(
    user: PortalUser,
    username: string,
    password: string,
  ): Promise<LoginResponse> {
    const externalResponse = await this.callExternalAuth(username, password);

    if (!externalResponse) {
      throw new AppException(
        'External authentication failed',
        HttpStatus.UNAUTHORIZED,
        'AUTH_FAILED',
      );
    }

    // External auth succeeded — update login state
    user.lastLoginAt = new Date();
    this.resetFailedAttempts(user);
    await this.userRepo.save(user);

    // Resolve access map
    const access = await this.permissionServiceV2.getResolvedAccess(user.id, user.role);

    // Generate tokens
    const legacyStateCode = await this.resolveLegacyStateCode(user);
    const accessToken = this.tokenService.generateAccessToken(user, access, legacyStateCode);
    const refreshToken = this.tokenService.generateRefreshToken(user);

    this.logger.log(
      `External login successful for user: ${username} with role: ${user.role}`,
    );

    return {
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      firstLogin: user.isFirstLogin === true,
      user: this.toLoginResponseUser(user, legacyStateCode),
      access,
    };
  }

  /**
   * Check if the account is currently locked.
   * If lock period has expired, auto-reset and return false.
   */
  private isAccountLocked(user: PortalUser): boolean {
    if (!user.lockedUntil) {
      return false;
    }

    const now = new Date();
    if (now > user.lockedUntil) {
      // Lock period expired — reset
      user.lockedUntil = null;
      user.failedAttempts = 0;
      // Save is deferred to the calling method's save to avoid extra DB round-trip
      return false;
    }

    return true;
  }

  /**
   * Fire a user-targeted notification (non-blocking). RVSK-NOTIFY-EMAIL-003.
   */
  private async notifyUser(
    eventCode: string,
    user: PortalUser,
    extraData: Record<string, unknown> = {},
  ): Promise<void> {
    const to = user.contactEmail || user.userEmail || '';
    if (!to) {
      return;
    }
    await this.notificationService.notify(eventCode, {
      to,
      referenceType: 'USER',
      referenceId: `${user.id}:${Date.now()}`,
      data: {
        user_name: user.displayName || user.username,
        user_id: user.username,
        role_name: user.role,
        ...extraData,
      },
    });
  }

  /**
   * Handle a failed login attempt: increment counter, lock if threshold reached.
   */
  private async handleFailedAttempt(user: PortalUser): Promise<void> {
    const attempts = (user.failedAttempts || 0) + 1;
    user.failedAttempts = attempts;

    let justLocked = false;
    if (attempts >= this.maxFailedAttempts) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + this.lockoutDurationMinutes);
      user.lockedUntil = lockUntil;
      justLocked = true;
      this.logger.warn(
        `Account locked for user: ${user.username} after ${attempts} failed attempts`,
      );
    }

    await this.userRepo.save(user);

    // RVSK-NOTIFY-EMAIL-003: USER_ACCOUNT_LOCKED (security alert) when locked.
    if (justLocked) {
      await this.notifyUser('USER_ACCOUNT_LOCKED', user);
    }
  }

  /**
   * Reset failed attempts counter and unlock.
   */
  private resetFailedAttempts(user: PortalUser): void {
    if (user.failedAttempts && user.failedAttempts > 0) {
      user.failedAttempts = 0;
      user.lockedUntil = null;
    }
  }

  /**
   * Call external auth service with credentials.
   */
  private async callExternalAuth(
    username: string,
    password: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      this.logger.debug(`Calling external auth at: ${this.externalAuthUrl}`);

      const response = await firstValueFrom(
        this.httpService.post<Record<string, unknown>>(
          this.externalAuthUrl,
          { username, password },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
          },
        ),
      );

      if (response.status >= 200 && response.status < 300 && response.data) {
        const success = response.data.success;
        if (success === false) {
          const message = (response.data.message as string) || 'Authentication failed';
          throw new AppException(message, HttpStatus.UNAUTHORIZED, 'AUTH_FAILED');
        }
        return response.data;
      }

      throw new AppException(
        'External authentication failed',
        HttpStatus.UNAUTHORIZED,
        'AUTH_FAILED',
      );
    } catch (error: unknown) {
      // If it's already an AppException, re-throw
      if (error instanceof AppException) {
        throw error;
      }

      // Check if it's an HTTP client error (4xx)
      if (this.isAxiosError(error) && error.response?.status && error.response.status >= 400 && error.response.status < 500) {
        this.logger.error(
          `External auth returned client error: ${error.response.status}`,
        );
        throw new AppException(
          'Invalid credentials',
          HttpStatus.UNAUTHORIZED,
          'AUTH_FAILED',
        );
      }

      // Network error or server error → service unavailable
      this.logger.error(
        `External auth service unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new AppException(
        'Authentication service unavailable. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE,
        'AUTH_SERVICE_UNAVAILABLE',
      );
    }
  }

  /**
   * Type guard for Axios errors.
   */
  private isAxiosError(error: unknown): error is AxiosError {
    return error instanceof Error && 'isAxiosError' in error;
  }

  /**
   * Map PortalUser to LoginResponseUser DTO.
   */
  private toLoginResponseUser(user: PortalUser, legacyStateCode = ''): LoginResponseUser {
    const responseUser = new LoginResponseUser();
    responseUser.id = user.id;
    responseUser.username = user.username;
    responseUser.displayName = user.displayName;
    responseUser.role = user.role;
    responseUser.stateCode = legacyStateCode || null;
    responseUser.stateKey = user.stateKey ?? null;
    responseUser.stateName = user.stateName ?? null;
    responseUser.districtKey = user.districtKey ?? null;
    responseUser.districtName = user.districtName ?? null;
    responseUser.blockKey = user.blockKey ?? null;
    responseUser.blockName = user.blockName ?? null;
    responseUser.isActive = user.isActive;
    responseUser.lastLoginAt = user.lastLoginAt || null;
    return responseUser;
  }

  /**
   * Map PortalUser to UserResponse.
   */
  private toUserResponse(user: PortalUser): UserResponse {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      stateKey: user.stateKey ?? null,
      stateName: user.stateName ?? null,
      districtKey: user.districtKey ?? null,
      districtName: user.districtName ?? null,
      blockKey: user.blockKey ?? null,
      blockName: user.blockName ?? null,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt || null,
    };
  }

  /**
   * Map PortalUser to ProfileResponse.
   */
  private toProfileResponse(user: PortalUser): ProfileResponse {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      stateKey: user.stateKey ?? null,
      stateName: user.stateName ?? null,
      districtKey: user.districtKey ?? null,
      districtName: user.districtName ?? null,
      blockKey: user.blockKey ?? null,
      blockName: user.blockName ?? null,
      phone: user.phone,
      designation: user.designation,
      department: user.department,
      userEmail: user.userEmail,
      contactEmail: user.contactEmail,
      mobileNumber: user.mobileNumber,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt || null,
    };
  }

  /**
   * Resolve the legacy 2-char state code (== vw_state_master.state_id) from
   * the user's stateKey, for backward-compatible JWT/domain consumers.
   * Returns '' when the user has no state or the key is unknown.
   */
  private async resolveLegacyStateCode(user: PortalUser): Promise<string> {
    if (!user.stateKey) return '';
    try {
      const rows = await this.userRepo.manager.query(
        `SELECT state_id FROM rvsk_portal.vw_state_master WHERE state_key = $1`,
        [user.stateKey],
      );
      return rows.length ? String(rows[0].state_id) : '';
    } catch {
      return '';
    }
  }
}


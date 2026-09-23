import {
  Injectable,
  Logger,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { AppException } from '@rvsk/common';

import { PortalUser } from './entities/portal-user.entity';
import { PasswordResetOtp } from './entities/password-reset-otp.entity';
import {
  RequestOtpDto,
  VerifyOtpDto,
  ResendOtpDto,
  ResetWithTokenDto,
} from './dto';
import {
  PASSWORD_RESET_NOTIFIER,
  PasswordResetNotifier,
} from './password-reset-notifier';

/** Acknowledgement returned by request/resend once the user is validated. */
export interface GenericAck {
  message: string;
}

/** Result of a successful OTP verification — the one-time reset token. */
export interface VerifyOtpResult {
  resetToken: string;
}

/**
 * RVSK-AUTH-PWDRESET-004 — OTP-based self-service password recovery.
 *
 * Identifier policy (per product decision): the user enters their USERNAME.
 * If the username does not map to an active user, the request is rejected with
 * an explicit "User doesn't exist" message. Only when the user is found is an
 * OTP generated and emailed to their address on record. (This intentionally
 * favours clear UX over the anti-enumeration posture in the original spec.)
 *
 * Security posture (all enforced here, server-side):
 *  - OTP and reset token are stored HASHED (SHA-256); plaintext is never
 *    persisted, logged, or returned (except the one-time reset token handed to
 *    the verified client).
 *  - Expiry, single-use, cooldown, attempt-cap and ownership are validated in
 *    this service; client timers/state are never trusted.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  private readonly otpLength: number;
  private readonly otpExpiryMinutes: number;
  private readonly resendCooldownSeconds: number;
  private readonly maxVerifyAttempts: number;
  private readonly resetTokenExpiryMinutes: number;
  private readonly bcryptStrength: number;

  private static readonly SENT_ACK: GenericAck = {
    message: 'A one-time code has been sent to your registered email.',
  };

  constructor(
    @InjectRepository(PortalUser)
    private readonly userRepo: Repository<PortalUser>,
    @InjectRepository(PasswordResetOtp)
    private readonly otpRepo: Repository<PasswordResetOtp>,
    private readonly configService: ConfigService,
    @Inject(PASSWORD_RESET_NOTIFIER)
    private readonly notifier: PasswordResetNotifier,
  ) {
    this.otpLength = this.readInt('OTP_LENGTH', 6);
    this.otpExpiryMinutes = this.readInt('OTP_EXPIRY_MINUTES', 15);
    this.resendCooldownSeconds = this.readInt('OTP_RESEND_COOLDOWN_SECONDS', 120);
    this.maxVerifyAttempts = this.readInt('OTP_MAX_VERIFY_ATTEMPTS', 5);
    this.resetTokenExpiryMinutes = this.readInt('PWD_RESET_TOKEN_EXPIRY_MINUTES', 10);
    const rounds = parseInt(String(this.configService.get('BCRYPT_STRENGTH', 12)), 10);
    this.bcryptStrength = Number.isNaN(rounds) ? 12 : rounds;
  }

  private readInt(key: string, fallback: number): number {
    const parsed = parseInt(String(this.configService.get(key, fallback)), 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  // ==================== Step 1 — request OTP ====================

  /**
   * RVSK-AUTH-PWDRESET-004.1 — validate the username, then generate + email an
   * OTP. Rejects with "User doesn't exist" when the username has no active
   * user; only sends the code when the user is found.
   */
  async requestOtp(dto: RequestOtpDto): Promise<GenericAck> {
    const user = await this.requireActiveUser(dto.username);
    await this.issueOtp(user);
    return PasswordResetService.SENT_ACK;
  }

  // ==================== Resend OTP (cooldown) ====================

  /**
   * RVSK-AUTH-PWDRESET-004.3 — resend, subject to the server-side cooldown.
   * Requires an existing user; a too-soon resend is rejected server-side.
   */
  async resendOtp(dto: ResendOtpDto): Promise<GenericAck> {
    const user = await this.requireActiveUser(dto.username);

    const latest = await this.otpRepo.findOne({
      where: { userId: user.id },
      order: { lastSentAt: 'DESC' },
    });
    const withinCooldown =
      latest &&
      Date.now() - latest.lastSentAt.getTime() <
        this.resendCooldownSeconds * 1000;
    if (withinCooldown) {
      throw new AppException(
        'Please wait before requesting another code.',
        HttpStatus.TOO_MANY_REQUESTS,
        'OTP_RESEND_COOLDOWN',
      );
    }

    await this.issueOtp(user);
    return PasswordResetService.SENT_ACK;
  }

  // ==================== Step 2 — verify OTP ====================

  /**
   * RVSK-AUTH-PWDRESET-004.2 — verify the OTP and issue a single-use reset
   * session token. Errors are deliberately generic ("invalid or expired code").
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<VerifyOtpResult> {
    const user = await this.requireActiveUser(dto.username);
    const row = await this.activeOtpFor(user.id);

    if (!row || row.expiresAt.getTime() <= Date.now()) {
      throw this.invalidCode();
    }

    if (row.attempts >= row.maxAttempts) {
      await this.invalidate(row);
      throw this.invalidCode();
    }

    const matches = this.constantTimeEqual(
      this.hashOtp(dto.otp),
      row.otpHash,
    );
    if (!matches) {
      row.attempts += 1;
      if (row.attempts >= row.maxAttempts) {
        row.invalidated = true;
      }
      await this.otpRepo.save(row);
      throw this.invalidCode();
    }

    // Success — issue a cryptographically random, single-use reset token.
    const resetToken = crypto.randomBytes(32).toString('hex');
    row.verifiedAt = new Date();
    row.resetTokenHash = this.hashToken(resetToken);
    row.resetTokenExpiresAt = new Date(
      Date.now() + this.resetTokenExpiryMinutes * 60 * 1000,
    );
    await this.otpRepo.save(row);

    return { resetToken };
  }

  // ==================== Step 3 — reset password ====================

  /**
   * RVSK-AUTH-PWDRESET-004.4 — set the new password using the reset token.
   */
  async reset(dto: ResetWithTokenDto): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new AppException(
        'New password and confirmation do not match',
        HttpStatus.BAD_REQUEST,
        'PASSWORD_MISMATCH',
      );
    }

    const row = await this.otpRepo.findOne({
      where: { resetTokenHash: this.hashToken(dto.resetToken) },
    });

    const tokenInvalid =
      !row ||
      row.invalidated ||
      row.consumedAt !== null ||
      !row.resetTokenExpiresAt ||
      row.resetTokenExpiresAt.getTime() <= Date.now();

    if (!row || tokenInvalid) {
      throw new AppException(
        'Invalid or expired reset session. Please restart password recovery.',
        HttpStatus.BAD_REQUEST,
        'INVALID_RESET_TOKEN',
      );
    }

    const user = await this.userRepo.findOne({ where: { id: row.userId } });
    if (!user) {
      // Token pointed at a user that no longer exists — treat as invalid.
      throw new AppException(
        'Invalid or expired reset session. Please restart password recovery.',
        HttpStatus.BAD_REQUEST,
        'INVALID_RESET_TOKEN',
      );
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, this.bcryptStrength);
    user.passwordChangedAt = new Date();
    user.failedAttempts = 0;
    user.lockedUntil = null;
    user.isFirstLogin = false;
    await this.userRepo.save(user);

    // Consume the token + OTP (single-use) and invalidate any remaining OTPs.
    row.consumedAt = new Date();
    row.invalidated = true;
    await this.otpRepo.save(row);
    await this.otpRepo.update(
      { userId: user.id, invalidated: false },
      { invalidated: true },
    );

    this.logger.log(`Password reset via OTP completed for user ${user.id}`);
  }

  // ==================== internals ====================

  /**
   * Generate a fresh OTP for the given user, invalidating any prior active OTP
   * (single active OTP per user), and email it to their address on record.
   */
  private async issueOtp(user: PortalUser): Promise<void> {
    // Invalidate any previously outstanding OTPs for this user.
    await this.otpRepo.update(
      { userId: user.id, invalidated: false },
      { invalidated: true },
    );

    const email = user.contactEmail || user.userEmail || '';
    const otp = this.generateOtp();
    const now = new Date();
    const row = this.otpRepo.create({
      id: uuidv4(),
      userId: user.id,
      email,
      otpHash: this.hashOtp(otp),
      expiresAt: new Date(now.getTime() + this.otpExpiryMinutes * 60 * 1000),
      attempts: 0,
      maxAttempts: this.maxVerifyAttempts,
      verifiedAt: null,
      consumedAt: null,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      lastSentAt: now,
      invalidated: false,
      createdAt: now,
    });
    await this.otpRepo.save(row);

    // Deliver via this feature's own mailer (direct SMTP). The OTP is never
    // logged/returned in responses.
    await this.notifier.sendPasswordResetOtp({
      user,
      otp,
      otpExpiryMinutes: this.otpExpiryMinutes,
    });
  }

  /** Newest non-invalidated, non-consumed OTP for a user. */
  private async activeOtpFor(userId: string): Promise<PasswordResetOtp | null> {
    return this.otpRepo.findOne({
      where: { userId, invalidated: false, consumedAt: null as any },
      order: { lastSentAt: 'DESC' },
    });
  }

  /**
   * Look up an active user by username. Throws "User doesn't exist" when there
   * is no matching active account.
   */
  private async requireActiveUser(username: string): Promise<PortalUser> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.username) = LOWER(:username)', {
        username: (username ?? '').trim(),
      })
      .getOne();

    if (!user || !user.isActive) {
      throw new AppException(
        "User doesn't exist",
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }
    return user;
  }

  private generateOtp(): string {
    const digits = Math.max(4, Math.min(10, this.otpLength));
    const max = 10 ** digits;
    // crypto.randomInt gives a uniform value in [0, max); zero-pad to length.
    const value = crypto.randomInt(0, max);
    return value.toString().padStart(digits, '0');
  }

  private hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private constantTimeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }

  private async invalidate(row: PasswordResetOtp): Promise<void> {
    row.invalidated = true;
    await this.otpRepo.save(row);
  }

  private invalidCode(): AppException {
    return new AppException(
      'Invalid or expired code',
      HttpStatus.BAD_REQUEST,
      'INVALID_OR_EXPIRED_OTP',
    );
  }
}

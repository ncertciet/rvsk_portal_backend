import {
  Entity,
  PrimaryColumn,
  Column,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * RVSK-AUTH-PWDRESET-004 — one row per issued OTP.
 *
 * Stores ONLY the hash of the OTP and (post-verify) the hash of the reset
 * session token. Plaintext secrets are never persisted, logged, or returned.
 * A single "active" OTP per user is enforced in code by marking prior rows
 * `invalidated = true` when a new OTP is issued.
 */
@Entity({ name: 'password_reset_otp', schema: 'rvsk_portal' })
export class PasswordResetOtp {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId: string;

  @Column({ name: 'email', nullable: false, length: 255 })
  email: string;

  @Column({ name: 'otp_hash', nullable: false, length: 255 })
  otpHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: false })
  expiresAt: Date;

  @Column({ name: 'attempts', type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'max_attempts', type: 'int', default: 5 })
  maxAttempts: number;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @Column({ name: 'reset_token_hash', nullable: true, length: 255 })
  resetTokenHash: string | null;

  @Column({ name: 'reset_token_expires_at', type: 'timestamptz', nullable: true })
  resetTokenExpiresAt: Date | null;

  @Column({ name: 'last_sent_at', type: 'timestamptz' })
  lastSentAt: Date;

  @Column({ name: 'invalidated', type: 'boolean', default: false })
  invalidated: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  setDefaults() {
    if (!this.id) {
      this.id = uuidv4();
    }
    const now = new Date();
    if (!this.createdAt) {
      this.createdAt = now;
    }
    if (!this.lastSentAt) {
      this.lastSentAt = now;
    }
  }
}

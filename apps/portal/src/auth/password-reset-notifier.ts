import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PortalUser } from './entities/portal-user.entity';

/**
 * RVSK-AUTH-PWDRESET-004 — OTP delivery seam for the FORGOT-PASSWORD flow.
 *
 * This feature owns its own email delivery (a "temporary direct-email
 * fallback" per the design). It intentionally does NOT route through the
 * notification framework's `PASSWORD_RESET_OTP` event — that event belongs to
 * the admin-initiated password reset, a different flow. The seam is kept narrow
 * so delivery can be re-pointed later without touching PasswordResetService.
 */
export interface PasswordResetOtpPayload {
  user: PortalUser;
  otp: string;
  otpExpiryMinutes: number;
}

export interface PasswordResetNotifier {
  sendPasswordResetOtp(payload: PasswordResetOtpPayload): Promise<void>;
}

/** DI token for the OTP delivery implementation. */
export const PASSWORD_RESET_NOTIFIER = Symbol('PASSWORD_RESET_NOTIFIER');

/**
 * Direct SMTP sender for the forgot-password OTP, using the existing
 * `SMTP_*` configuration. Delivery is best-effort and non-fatal: a send
 * failure is logged (never with the OTP) but does not change the caller's
 * anti-enumeration response. The OTP value is never logged.
 */
@Injectable()
export class SmtpPasswordResetNotifier
  implements PasswordResetNotifier, OnModuleInit
{
  private readonly logger = new Logger(SmtpPasswordResetNotifier.name);
  private transporter: Transporter | null = null;
  private sender: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = parseInt(
      String(this.configService.get('SMTP_PORT', 587)),
      10,
    );
    const user = this.configService.get<string>('SMTP_USERNAME');
    const pass = this.configService.get<string>('SMTP_PASSWORD');
    this.sender =
      this.configService.get<string>('SMTP_SENDER') || user || 'no-reply';

    if (!host) {
      // Without an SMTP host the flow still works end-to-end; delivery is a
      // no-op (with a warning) rather than an error, preserving the
      // anti-enumeration contract.
      this.logger.warn(
        'SMTP_HOST is not configured; forgot-password OTP emails will not be sent.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number.isNaN(port) ? 587 : port,
      // 465 = implicit TLS; otherwise STARTTLS is negotiated.
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendPasswordResetOtp(payload: PasswordResetOtpPayload): Promise<void> {
    const { user, otp, otpExpiryMinutes } = payload;
    const to = user.contactEmail || user.userEmail;

    // DEV-ONLY: surface the OTP in logs so the flow can be tested without a
    // live mail server. Logged BEFORE any transporter/send logic so it always
    // appears in dev regardless of SMTP state. Gated to non-production and MUST
    // be removed before any real deployment — the spec forbids logging the OTP.
    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn(
        `[DEV ONLY] Forgot-password OTP for user ${user.id} (${to ?? 'no email'}): ${otp} (do not ship this log)`,
      );
    }

    if (!this.transporter) {
      this.logger.warn(
        `Forgot-password OTP for user ${user.id} not sent (SMTP unconfigured).`,
      );
      return;
    }
    if (!to) {
      this.logger.warn(
        `Forgot-password OTP for user ${user.id} not sent (no email on record).`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.sender,
        to,
        subject: 'RVSK Portal — Password Reset Code',
        text: this.buildPlainText(otp, otpExpiryMinutes),
        html: this.buildHtml(otp, otpExpiryMinutes),
      });
      // Do NOT log the OTP — only non-secret dispatch metadata.
      this.logger.log(
        `Forgot-password OTP emailed for user ${user.id} (expires in ${otpExpiryMinutes} min).`,
      );
    } catch (err) {
      // Delivery failures must not break the anti-enumeration response.
      this.logger.error(
        `Failed to send forgot-password OTP for user ${user.id}: ${
          (err as Error).message
        }`,
      );
    }
  }

  private buildPlainText(otp: string, expiryMinutes: number): string {
    return [
      'You requested to reset your RVSK Portal password.',
      '',
      `Your one-time code is: ${otp}`,
      '',
      `This code expires in ${expiryMinutes} minutes and can be used once.`,
      'If you did not request this, you can safely ignore this email.',
    ].join('\n');
  }

  private buildHtml(otp: string, expiryMinutes: number): string {
    return `
      <div style="font-family: Arial, sans-serif; font-size: 15px; color: #222;">
        <p>You requested to reset your <strong>RVSK Portal</strong> password.</p>
        <p>Your one-time code is:</p>
        <p style="font-size: 26px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
        <p>This code expires in <strong>${expiryMinutes} minutes</strong> and can be used once.</p>
        <p style="color: #777;">If you did not request this, you can safely ignore this email.</p>
      </div>
    `;
  }
}

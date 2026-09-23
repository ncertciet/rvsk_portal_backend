import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPPool from 'nodemailer/lib/smtp-pool';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export interface SendMailArgs {
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  sent: boolean;
  attempts: number;
  error?: string;
}

/**
 * RVSK-NOTIFY-EMAIL-003 — thin SMTP transport wrapper (nodemailer).
 *
 * Pooled transport with timeouts, multipart HTML+text, From display-name and
 * Reply-To. Bounded retry with backoff on transient failures. Credentials come
 * from env and are never logged.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  private sender: string;
  private fromName: string;
  private replyTo: string | null;
  private maxRetries: number;
  private retryBackoffMs: number;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.readInt('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USERNAME');
    const pass = this.configService.get<string>('SMTP_PASSWORD');
    const secureCfg = String(
      this.configService.get('SMTP_SECURE', 'false'),
    ).toLowerCase();

    this.sender =
      this.configService.get<string>('SMTP_SENDER') || user || 'no-reply';
    this.fromName = this.configService.get<string>('MAIL_FROM_NAME', 'RVSK Portal');
    this.replyTo = this.configService.get<string>('MAIL_REPLY_TO') || null;
    this.maxRetries = this.readInt('MAIL_MAX_RETRIES', 3);
    this.retryBackoffMs = this.readInt('MAIL_RETRY_BACKOFF_MS', 2000);

    if (!host) {
      this.logger.warn(
        'SMTP_HOST is not configured; notification emails will not be sent (logged as FAILED).',
      );
      return;
    }

    const pool =
      String(this.configService.get('SMTP_POOL', 'true')).toLowerCase() === 'true';
    const common = {
      host,
      port,
      secure: secureCfg === 'true' || port === 465,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: this.readInt('SMTP_CONNECTION_TIMEOUT_MS', 10000),
      greetingTimeout: this.readInt('SMTP_GREETING_TIMEOUT_MS', 10000),
      socketTimeout: this.readInt('SMTP_SOCKET_TIMEOUT_MS', 20000),
    };
    const transportOptions: SMTPPool.Options | SMTPTransport.Options = pool
      ? {
          ...common,
          pool: true,
          maxConnections: this.readInt('SMTP_MAX_CONNECTIONS', 5),
        }
      : common;
    this.transporter = nodemailer.createTransport(transportOptions as SMTPPool.Options);
  }

  /**
   * Send with bounded retry. Returns a result rather than throwing so callers
   * (NotificationService) remain non-blocking.
   */
  async send(args: SendMailArgs): Promise<SendResult> {
    if (!this.transporter) {
      return {
        sent: false,
        attempts: 0,
        error: 'SMTP transport not configured',
      };
    }

    let lastError = '';
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.transporter.sendMail({
          from: { name: this.fromName, address: this.sender },
          to: args.to,
          cc: args.cc || undefined,
          bcc: args.bcc || undefined,
          replyTo: this.replyTo || undefined,
          subject: args.subject,
          html: args.html,
          text: args.text,
        });
        return { sent: true, attempts: attempt };
      } catch (err) {
        lastError = (err as Error).message;
        // Do not log recipient PII beyond what's necessary; never log credentials.
        this.logger.warn(
          `Email send attempt ${attempt}/${this.maxRetries} failed: ${lastError}`,
        );
        if (attempt < this.maxRetries) {
          await this.delay(this.retryBackoffMs * attempt);
        }
      }
    }
    return { sent: false, attempts: this.maxRetries, error: lastError };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private readInt(key: string, fallback: number): number {
    const parsed = parseInt(String(this.configService.get(key, fallback)), 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
}

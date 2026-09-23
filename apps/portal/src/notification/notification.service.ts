import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { NotificationConfig } from './entities/notification-config.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { EmailLayout } from './entities/email-layout.entity';
import { EmailService } from './email.service';
import { wrapInLayout, BrandContext } from './layout';
import {
  renderTemplate,
  sanitizeBodyHtml,
  htmlToText,
} from './template-render';

/**
 * Context passed by business modules when raising a notification.
 *
 * - `to` (+ optional `cc`/`bcc`) is the RESOLVED recipient(s). Business modules
 *   resolve their own recipients (USER/SPOC/STATE/creator) and pass them here,
 *   keeping this framework decoupled from domain internals.
 * - `data` supplies template placeholder values.
 * - `referenceType`/`referenceId` link the log to the source record.
 */
export interface NotifyContext {
  to?: string | null;
  cc?: string | null;
  bcc?: string | null;
  data?: Record<string, unknown>;
  referenceType?: string;
  referenceId?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationConfig)
    private readonly configRepo: Repository<NotificationConfig>,
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    @InjectRepository(EmailLayout)
    private readonly layoutRepo: Repository<EmailLayout>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Raise a notification for an event. NEVER throws — a mail failure is caught,
   * logged to notification_log, and the caller's transaction is unaffected.
   */
  async notify(eventCode: string, ctx: NotifyContext): Promise<void> {
    try {
      const cfg = await this.configRepo.findOne({ where: { eventCode } });
      if (!cfg || !cfg.isActive || !cfg.emailEnabled) {
        return; // no-op; workflow continues
      }

      const recipient = (ctx.to || '').trim();
      if (!recipient) {
        this.logger.warn(
          `notify(${eventCode}) skipped: no recipient resolved.`,
        );
        return;
      }

      await this.renderAndSend(cfg, recipient, ctx, false);
    } catch (err) {
      // Absolute safety net — notify must never bubble up to the business txn.
      this.logger.error(
        `notify(${eventCode}) unexpected error: ${(err as Error).message}`,
      );
    }
  }

  /** Test-send: renders with the provided/sample data, ignores email_enabled, marks is_test. */
  async testSend(
    eventCode: string,
    toEmail: string,
    sampleData?: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    const cfg = await this.configRepo.findOne({ where: { eventCode } });
    if (!cfg) {
      return { success: false, message: `Unknown event: ${eventCode}` };
    }
    const data = sampleData ?? this.sampleDataFor(cfg);
    await this.renderAndSend(
      cfg,
      toEmail,
      { to: toEmail, data, referenceType: 'TEST' },
      true,
    );
    return { success: true, message: `Test email dispatched to ${toEmail}` };
  }

  /** Render preview HTML (+text) with sample data — no send. */
  async renderPreview(
    eventCode: string,
  ): Promise<{ subject: string; html: string; text: string }> {
    const cfg = await this.configRepo.findOne({ where: { eventCode } });
    if (!cfg) {
      return { subject: '', html: '', text: '' };
    }
    return this.render(cfg, this.sampleDataFor(cfg));
  }

  /** Reset an event's subject/body to the factory default. */
  async resetToDefault(
    eventCode: string,
    changedBy?: string,
  ): Promise<NotificationConfig | null> {
    const cfg = await this.configRepo.findOne({ where: { eventCode } });
    if (!cfg) {
      return null;
    }
    cfg.subjectTemplate = cfg.defaultSubject;
    cfg.bodyTemplate = cfg.defaultBody;
    cfg.isCustomized = false;
    cfg.updatedAt = new Date();
    cfg.updatedBy = changedBy ?? null;
    return this.configRepo.save(cfg);
  }

  /** Manually resend a FAILED (or any) log entry using its stored recipient/subject. */
  async resend(logId: string): Promise<{ success: boolean; message: string }> {
    const log = await this.logRepo.findOne({ where: { id: logId } });
    if (!log) {
      return { success: false, message: 'Log entry not found' };
    }
    const cfg = await this.configRepo.findOne({
      where: { eventCode: log.eventCode },
    });
    if (!cfg || !log.recipientEmail) {
      return { success: false, message: 'Cannot resend: missing config or recipient' };
    }
    // Re-render with sample data (original context is not persisted); primarily
    // for transient-failure recovery where the template is unchanged.
    const rendered = this.render(cfg, this.sampleDataFor(cfg));
    const result = await this.emailService.send({
      to: log.recipientEmail,
      cc: log.cc,
      subject: log.subject || rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    log.retryCount += 1;
    log.attempts += result.attempts;
    log.lastAttemptAt = new Date();
    if (result.sent) {
      log.status = 'SENT';
      log.sentAt = new Date();
      log.errorMessage = null;
    } else {
      log.status = 'FAILED';
      log.errorMessage = result.error ?? 'Unknown error';
    }
    await this.logRepo.save(log);
    return {
      success: result.sent,
      message: result.sent ? 'Resent successfully' : `Resend failed: ${log.errorMessage}`,
    };
  }

  // ==================== internals ====================

  private async renderAndSend(
    cfg: NotificationConfig,
    recipient: string,
    ctx: NotifyContext,
    isTest: boolean,
  ): Promise<void> {
    const rendered = this.render(cfg, ctx.data ?? {});
    const dedupeKey = [
      cfg.eventCode,
      ctx.referenceId ?? '',
      recipient,
    ].join(':');

    // Dedupe guard: skip if an identical non-test notification already SENT.
    if (!isTest && ctx.referenceId) {
      const existing = await this.logRepo.findOne({
        where: { dedupeKey, status: 'SENT' },
      });
      if (existing) {
        this.logger.log(
          `notify(${cfg.eventCode}) deduped for ${dedupeKey} (already SENT).`,
        );
        return;
      }
    }

    const log = this.logRepo.create({
      eventCode: cfg.eventCode,
      recipientEmail: recipient,
      cc: ctx.cc ?? cfg.cc ?? null,
      subject: rendered.subject.substring(0, 255),
      status: 'PENDING',
      referenceType: ctx.referenceType ?? null,
      referenceId: ctx.referenceId ?? null,
      dedupeKey,
      attempts: 0,
      retryCount: 0,
      isTest,
    });
    await this.logRepo.save(log);

    const result = await this.emailService.send({
      to: recipient,
      cc: ctx.cc ?? cfg.cc ?? null,
      bcc: ctx.bcc ?? cfg.bcc ?? null,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    log.attempts = result.attempts;
    log.lastAttemptAt = new Date();
    if (result.sent) {
      log.status = 'SENT';
      log.sentAt = new Date();
    } else {
      log.status = 'FAILED';
      log.errorMessage = result.error ?? 'Unknown error';
    }
    await this.logRepo.save(log);
  }

  /** Merge brand tokens, render subject + inner body, wrap in branded layout, derive text. */
  private render(
    cfg: NotificationConfig,
    data: Record<string, unknown>,
  ): { subject: string; html: string; text: string } {
    const brand = this.brandContext();
    const merged: Record<string, unknown> = {
      brand_name: brand.brandName,
      support_email: brand.supportEmail ?? '',
      portal_url: this.configService.get<string>('PORTAL_URL', ''),
      ...data,
    };

    const subject = renderTemplate(
      cfg.subjectTemplate ?? cfg.defaultSubject,
      merged,
    );
    const innerRaw = renderTemplate(
      cfg.bodyTemplate ?? cfg.defaultBody,
      merged,
    );
    const innerSafe = sanitizeBodyHtml(innerRaw);
    const html = wrapInLayout(innerSafe, this.headerOverride, brand);
    const text = cfg.textTemplate
      ? renderTemplate(cfg.textTemplate, merged)
      : htmlToText(html);
    return { subject, html, text };
  }

  private headerOverride: string | null = null;
  private cachedBrand: BrandContext | null = null;

  private brandContext(): BrandContext {
    // Env defaults; DB layout overrides where present. Cached per-process; the
    // layout edit path can clear this cache in a future enhancement.
    if (this.cachedBrand) {
      return this.cachedBrand;
    }
    const envBrand: BrandContext = {
      brandName: this.configService.get<string>('BRAND_NAME', 'RVSK Portal'),
      logoUrl: this.configService.get<string>('LOGO_URL') || null,
      primaryColor: this.configService.get<string>('BRAND_PRIMARY_COLOR', '#0b5394'),
      footerHtml: this.configService.get<string>('EMAIL_FOOTER_TEXT') || null,
      supportEmail: this.configService.get<string>('SUPPORT_EMAIL') || null,
    };
    this.cachedBrand = envBrand;
    return envBrand;
  }

  /** Load DB layout (async) to override env brand defaults; call before rendering when needed. */
  async refreshBrandFromDb(): Promise<void> {
    const layout = await this.layoutRepo.findOne({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
    });
    const env = this.brandContext();
    if (layout) {
      this.cachedBrand = {
        brandName: layout.brandName || env.brandName,
        logoUrl: layout.logoUrl || env.logoUrl,
        primaryColor: layout.primaryColor || env.primaryColor,
        footerHtml: layout.footerHtml || env.footerHtml,
        supportEmail: layout.supportEmail || env.supportEmail,
      };
      this.headerOverride = layout.headerHtml || null;
    }
  }

  /** Clear the cached brand so the next render reloads from DB/env. */
  clearBrandCache(): void {
    this.cachedBrand = null;
    this.headerOverride = null;
  }

  private sampleDataFor(cfg: NotificationConfig): Record<string, unknown> {
    return {
      user_name: 'Test User',
      user_id: 'testuser',
      role_name: 'State_Admin',
      grievance_id: 'GRV-2026-0001',
      grievance_subject: 'Sample grievance subject',
      spoc_name: 'Sample SPOC',
      state_name: 'Sample State',
      form_title: 'Sample Form',
      due_date: '2026-12-31',
      due_date_clause: ' (due 2026-12-31)',
      submitted_at: new Date().toISOString().slice(0, 10),
    };
  }
}

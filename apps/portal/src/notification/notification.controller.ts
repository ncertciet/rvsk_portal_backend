import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles, CurrentUser, AuthenticatedUser, AppException } from '@rvsk/common';

import { NotificationConfig } from './entities/notification-config.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationConfigAudit } from './entities/notification-config-audit.entity';
import { EmailLayout } from './entities/email-layout.entity';
import { NotificationService } from './notification.service';
import { validateTemplate, sanitizeBodyHtml } from './template-render';
import {
  UpdateNotificationConfigDto,
  TestSendDto,
  UpdateEmailLayoutDto,
} from './dto/notification.dto';

/**
 * RVSK-NOTIFY-EMAIL-003 — Super-Admin-only config, logs, layout and actions.
 * Routes (with API prefix): /api/v1/notifications/*
 */
@Roles('Super_Admin')
@Controller('notifications')
export class NotificationController {
  constructor(
    @InjectRepository(NotificationConfig)
    private readonly configRepo: Repository<NotificationConfig>,
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    @InjectRepository(NotificationConfigAudit)
    private readonly auditRepo: Repository<NotificationConfigAudit>,
    @InjectRepository(EmailLayout)
    private readonly layoutRepo: Repository<EmailLayout>,
    private readonly notificationService: NotificationService,
  ) {}

  @Get('config')
  async listConfig(): Promise<NotificationConfig[]> {
    return this.configRepo.find({ order: { eventName: 'ASC' } });
  }

  @Put('config/:eventCode')
  async updateConfig(
    @Param('eventCode') eventCode: string,
    @Body() dto: UpdateNotificationConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationConfig> {
    const cfg = await this.configRepo.findOne({ where: { eventCode } });
    if (!cfg) {
      throw new AppException(
        `Unknown event: ${eventCode}`,
        HttpStatus.NOT_FOUND,
        'EVENT_NOT_FOUND',
      );
    }

    const allowedTokens = (cfg.allowedTokens || '').split(',').map((t) => t.trim()).filter(Boolean);

    // Validate + sanitize templates before persisting.
    if (dto.subjectTemplate !== undefined) {
      const res = validateTemplate(dto.subjectTemplate, allowedTokens);
      if (!res.valid) {
        throw new AppException(
          `Invalid subject template: ${res.errors.join('; ')}`,
          HttpStatus.BAD_REQUEST,
          'INVALID_TEMPLATE',
        );
      }
    }
    if (dto.bodyTemplate !== undefined) {
      const res = validateTemplate(dto.bodyTemplate, allowedTokens);
      if (!res.valid) {
        throw new AppException(
          `Invalid body template: ${res.errors.join('; ')}`,
          HttpStatus.BAD_REQUEST,
          'INVALID_TEMPLATE',
        );
      }
    }

    const audits: NotificationConfigAudit[] = [];
    const track = (field: string, prev: unknown, next: unknown) => {
      if (next !== undefined && String(prev ?? '') !== String(next ?? '')) {
        audits.push(
          this.auditRepo.create({
            eventCode,
            fieldChanged: field,
            previousValue: prev == null ? null : String(prev),
            newValue: next == null ? null : String(next),
            changedBy: user?.userId ?? null,
          }),
        );
      }
    };

    track('email_enabled', cfg.emailEnabled, dto.emailEnabled);
    track('recipient_type', cfg.recipientType, dto.recipientType);
    track('recipient_value', cfg.recipientValue, dto.recipientValue);
    track('cc', cfg.cc, dto.cc);
    track('bcc', cfg.bcc, dto.bcc);
    track('subject_template', cfg.subjectTemplate, dto.subjectTemplate);
    track('body_template', cfg.bodyTemplate, dto.bodyTemplate);
    track('text_template', cfg.textTemplate, dto.textTemplate);

    if (dto.emailEnabled !== undefined) cfg.emailEnabled = dto.emailEnabled;
    if (dto.recipientType !== undefined) cfg.recipientType = dto.recipientType;
    if (dto.recipientValue !== undefined) cfg.recipientValue = dto.recipientValue;
    if (dto.cc !== undefined) cfg.cc = dto.cc;
    if (dto.bcc !== undefined) cfg.bcc = dto.bcc;
    if (dto.subjectTemplate !== undefined) cfg.subjectTemplate = dto.subjectTemplate;
    if (dto.bodyTemplate !== undefined) cfg.bodyTemplate = sanitizeBodyHtml(dto.bodyTemplate);
    if (dto.textTemplate !== undefined) cfg.textTemplate = dto.textTemplate;

    if (dto.subjectTemplate !== undefined || dto.bodyTemplate !== undefined) {
      cfg.isCustomized = true;
    }
    cfg.updatedAt = new Date();
    cfg.updatedBy = user?.userId ?? null;

    const saved = await this.configRepo.save(cfg);
    if (audits.length) {
      await this.auditRepo.save(audits);
    }
    return saved;
  }

  @Get('config/:eventCode/preview')
  async preview(@Param('eventCode') eventCode: string) {
    await this.notificationService.refreshBrandFromDb();
    return this.notificationService.renderPreview(eventCode);
  }

  @Post('config/:eventCode/test-send')
  @HttpCode(200)
  async testSend(
    @Param('eventCode') eventCode: string,
    @Body() dto: TestSendDto,
  ) {
    await this.notificationService.refreshBrandFromDb();
    return this.notificationService.testSend(eventCode, dto.toEmail);
  }

  @Post('config/:eventCode/reset')
  @HttpCode(200)
  async reset(
    @Param('eventCode') eventCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationConfig> {
    const cfg = await this.notificationService.resetToDefault(
      eventCode,
      user?.userId,
    );
    if (!cfg) {
      throw new AppException(
        `Unknown event: ${eventCode}`,
        HttpStatus.NOT_FOUND,
        'EVENT_NOT_FOUND',
      );
    }
    return cfg;
  }

  @Get('layout')
  async getLayout(): Promise<EmailLayout | null> {
    return this.layoutRepo.findOne({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
    });
  }

  @Put('layout')
  async updateLayout(
    @Body() dto: UpdateEmailLayoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmailLayout> {
    let layout = await this.layoutRepo.findOne({
      where: { isActive: true },
      order: { updatedAt: 'DESC' },
    });
    if (!layout) {
      layout = this.layoutRepo.create({ name: 'DEFAULT', isActive: true });
    }
    if (dto.logoUrl !== undefined) layout.logoUrl = dto.logoUrl;
    if (dto.brandName !== undefined) layout.brandName = dto.brandName;
    if (dto.primaryColor !== undefined) layout.primaryColor = dto.primaryColor;
    if (dto.headerHtml !== undefined) layout.headerHtml = sanitizeBodyHtml(dto.headerHtml);
    if (dto.footerHtml !== undefined) layout.footerHtml = sanitizeBodyHtml(dto.footerHtml);
    if (dto.supportEmail !== undefined) layout.supportEmail = dto.supportEmail;
    layout.updatedAt = new Date();
    layout.updatedBy = user?.userId ?? null;
    const saved = await this.layoutRepo.save(layout);
    this.notificationService.clearBrandCache();
    return saved;
  }

  @Get('logs')
  async listLogs(
    @Query('event') event?: string,
    @Query('status') status?: string,
    @Query('isTest') isTest?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
  ) {
    const qb = this.logRepo.createQueryBuilder('l');
    if (event) qb.andWhere('l.eventCode = :event', { event });
    if (status) qb.andWhere('l.status = :status', { status });
    if (isTest !== undefined) {
      qb.andWhere('l.isTest = :isTest', { isTest: isTest === 'true' });
    }
    const take = Math.min(Math.max(parseInt(pageSize, 10) || 25, 1), 200);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
    qb.orderBy('l.createdAt', 'DESC').skip(skip).take(take);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: parseInt(page, 10) || 1, pageSize: take };
  }

  @Post('logs/:id/resend')
  @HttpCode(200)
  async resend(@Param('id') id: string) {
    await this.notificationService.refreshBrandFromDb();
    return this.notificationService.resend(id);
  }
}

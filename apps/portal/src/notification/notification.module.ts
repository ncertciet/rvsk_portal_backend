import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationConfig } from './entities/notification-config.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationConfigAudit } from './entities/notification-config-audit.entity';
import { EmailLayout } from './entities/email-layout.entity';
import { EmailService } from './email.service';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { BrandingController } from './branding.controller';

/**
 * RVSK-NOTIFY-EMAIL-003 — Configurable Email Notification Framework.
 * Exports NotificationService for business modules to raise events.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationConfig,
      NotificationLog,
      NotificationConfigAudit,
      EmailLayout,
    ]),
  ],
  controllers: [NotificationController, BrandingController],
  providers: [EmailService, NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

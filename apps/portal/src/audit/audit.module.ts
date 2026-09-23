import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLog } from './entities/audit-log.entity';
import { ActivityLogEntry } from './entities/activity-log.entity';
import { AuditService } from './audit.service';

/**
 * Central audit + activity logging.
 *
 * Declared @Global so any feature module (Users, Forms, Grievances, VSK) can
 * inject AuditService without re-importing this module — matching the existing
 * global CommonModule pattern.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, ActivityLogEntry])],
  providers: [AuditService],
  exports: [AuditService, TypeOrmModule],
})
export class AuditModule {}

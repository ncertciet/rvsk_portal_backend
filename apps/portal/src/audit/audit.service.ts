import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AuditLog } from './entities/audit-log.entity';
import { ActivityLogEntry } from './entities/activity-log.entity';

/** Parameters for a forensic audit-trail entry (vsk_audit_log). */
export interface AuditRecordParams {
  /** Logical entity name, e.g. 'USER', 'FORM', 'GRIEVANCE', 'VSK_OFFICER'. */
  entityName: string;
  /** Affected entity primary key. */
  entityId: string;
  /** CREATE | UPDATE | DELETE | domain action (PUBLISH, ASSIGN, ...). */
  actionType: string;
  /** Acting user id (null for system-initiated changes). */
  userId?: string | null;
  /** Acting user display/username (denormalised for readability). */
  userName?: string | null;
  /** Acting user's 2-char state code. */
  userStateCode?: string | null;
  /** Snapshot before the change (object or already-serialised string). */
  oldValues?: unknown;
  /** Snapshot after the change (object or already-serialised string). */
  newValues?: unknown;
}

/** Parameters for a curated dashboard feed entry (activity_log). */
export interface ActivityLogParams {
  /** Module bucket: USERS | FORMS | GRIEVANCES | VSK. */
  module: string;
  /** Short action verb: CREATE | PUBLISH | ASSIGN | RESOLVE ... */
  action: string;
  /** Human-readable sentence shown in the feed. */
  description: string;
  /**
   * Acting user id (FK to portal_users). The schema column is NOT NULL, so a
   * null/absent actor causes the row to be skipped (logged as a warning)
   * rather than inserted.
   */
  performedBy?: string | null;
  /** Affected entity id (optional). */
  entityId?: string | null;
  /** Acting user's 2-char state code (optional). */
  stateCode?: string | null;
}

/**
 * Central audit + activity logging.
 *
 * Two independent write paths, both fully non-blocking: a logging failure is
 * swallowed (warn only) so it can never break the business operation that
 * triggered it. Mirrors the existing GrievanceHistory try/catch pattern.
 *
 *  - record(): forensic audit trail → vsk_audit_log (with old/new values)
 *  - log():    curated dashboard feed → activity_log (human-readable)
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(ActivityLogEntry)
    private readonly activityRepo: Repository<ActivityLogEntry>,
  ) {}

  /**
   * Write a forensic audit-trail row. Never throws.
   */
  async record(params: AuditRecordParams): Promise<void> {
    try {
      const entry = new AuditLog();
      entry.id = uuidv4();
      entry.entityName = params.entityName;
      entry.entityId = params.entityId;
      entry.actionType = params.actionType;
      entry.oldValues = this.serialise(params.oldValues);
      entry.newValues = this.serialise(params.newValues);
      entry.userId = params.userId ?? null;
      entry.userName = params.userName ?? null;
      entry.userStateCode = params.userStateCode ?? null;
      await this.auditRepo.save(entry);
    } catch (e: any) {
      this.logger.warn(
        `Audit record failed (${params.entityName}/${params.actionType}): ${e?.message ?? e}`,
      );
    }
  }

  /**
   * Write a curated activity-feed row (shown on Super/RVSK Admin dashboard).
   * Never throws.
   */
  async log(params: ActivityLogParams): Promise<void> {
    // performed_by is NOT NULL in the schema; without an actor there is no
    // meaningful feed entry, so skip rather than fail an insert.
    if (!params.performedBy) {
      this.logger.warn(
        `Activity log skipped (${params.module}/${params.action}): no acting user`,
      );
      return;
    }
    try {
      const entry = new ActivityLogEntry();
      entry.id = uuidv4();
      entry.module = params.module;
      entry.action = params.action;
      entry.description = params.description?.slice(0, 500) ?? null;
      entry.entityId = params.entityId ?? null;
      entry.performedBy = params.performedBy;
      entry.stateCode = params.stateCode ?? null;
      await this.activityRepo.save(entry);
    } catch (e: any) {
      this.logger.warn(
        `Activity log failed (${params.module}/${params.action}): ${e?.message ?? e}`,
      );
    }
  }

  /**
   * Convenience: write both the forensic audit row and the dashboard feed row
   * in one call. Both are independent and non-blocking.
   */
  async recordAndLog(
    audit: AuditRecordParams,
    activity: ActivityLogParams,
  ): Promise<void> {
    await Promise.all([this.record(audit), this.log(activity)]);
  }

  private serialise(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}

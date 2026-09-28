import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppException, RoleConstants } from '@rvsk/common';
import { StateSpocMapping } from './entities/state-spoc-mapping.entity';
import { PortalUser } from '../auth/entities/portal-user.entity';
import { Grievance } from '../grievance/entities/grievance.entity';
import { GrievanceHistory } from '../grievance/entities/grievance-history.entity';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';

/** Grievance statuses that are still actionable (non-terminal). */
const NON_TERMINAL_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'UNDER_REVIEW',
  'IN_PROGRESS',
  'RESPONSE_PROVIDED',
  'REOPENED',
];

export interface AssignmentRow {
  stateKey: string;
  stateName: string | null;
  stateId: string | null;
  spocUserId: string | null;
  spocName: string | null;
  assignedAt: Date | null;
  assignedByName: string | null;
  isActive: boolean;
}

export interface HistoryRow {
  id: string;
  stateKey: string;
  spocUserId: string;
  spocName: string | null;
  isActive: boolean;
  assignedAt: Date;
  assignedByName: string | null;
  unassignedAt: Date | null;
  unassignedByName: string | null;
  note: string | null;
}

@Injectable()
export class SpocMappingService {
  private readonly logger = new Logger(SpocMappingService.name);

  constructor(
    @InjectRepository(StateSpocMapping)
    private readonly mappingRepo: Repository<StateSpocMapping>,
    @InjectRepository(PortalUser)
    private readonly userRepo: Repository<PortalUser>,
    @InjectRepository(Grievance)
    private readonly grievanceRepo: Repository<Grievance>,
    @InjectRepository(GrievanceHistory)
    private readonly historyRepo: Repository<GrievanceHistory>,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== READ (consumed by GrievanceService + UI) ====================

  /** Current SPOC user id for a State (null if unmapped). */
  async getActiveSpocForState(stateKey: string | null): Promise<string | null> {
    if (!stateKey) return null;
    const row = await this.mappingRepo.findOne({
      where: { stateKey, isActive: true },
    });
    return row ? row.spocUserId : null;
  }

  /** State keys actively mapped to a SPOC (drives SPOC grievance visibility). */
  async getActiveStateKeysForSpoc(spocUserId: string): Promise<string[]> {
    const rows = await this.mappingRepo.find({
      where: { spocUserId, isActive: true },
    });
    return rows.map((r) => String(r.stateKey));
  }

  /** All States with their current SPOC (incl. unassigned States). */
  async listAssignments(): Promise<AssignmentRow[]> {
    const states = await this.dataSource.query(
      `SELECT state_key, state_id, state_name
         FROM rvsk_portal.vw_state_master
        WHERE is_active = true
        ORDER BY state_name`,
    );

    const active = await this.mappingRepo.find({ where: { isActive: true } });
    const byState = new Map<string, StateSpocMapping>();
    active.forEach((m) => byState.set(String(m.stateKey), m));

    const userIds = new Set<string>();
    active.forEach((m) => {
      if (m.spocUserId) userIds.add(m.spocUserId);
      if (m.assignedBy) userIds.add(m.assignedBy);
    });
    const userMap = await this.resolveUsers([...userIds]);

    return states.map((s: any) => {
      const key = String(s.state_key);
      const m = byState.get(key);
      return {
        stateKey: key,
        stateName: s.state_name ?? null,
        stateId: s.state_id != null ? String(s.state_id) : null,
        spocUserId: m ? m.spocUserId : null,
        spocName: m ? this.nameOf(userMap.get(m.spocUserId)) : null,
        assignedAt: m ? m.assignedAt : null,
        assignedByName: m ? this.nameOf(userMap.get(m.assignedBy)) : null,
        isActive: !!m,
      };
    });
  }

  /** Ordered assignment history for a single State (active + retired). */
  async getStateHistory(stateKey: string): Promise<HistoryRow[]> {
    const rows = await this.mappingRepo.find({
      where: { stateKey },
      order: { assignedAt: 'DESC' },
    });
    const userIds = new Set<string>();
    rows.forEach((r) => {
      if (r.spocUserId) userIds.add(r.spocUserId);
      if (r.assignedBy) userIds.add(r.assignedBy);
      if (r.unassignedBy) userIds.add(r.unassignedBy);
    });
    const userMap = await this.resolveUsers([...userIds]);

    return rows.map((r) => ({
      id: r.id,
      stateKey: String(r.stateKey),
      spocUserId: r.spocUserId,
      spocName: this.nameOf(userMap.get(r.spocUserId)),
      isActive: r.isActive,
      assignedAt: r.assignedAt,
      assignedByName: this.nameOf(userMap.get(r.assignedBy)),
      unassignedAt: r.unassignedAt,
      unassignedByName: r.unassignedBy ? this.nameOf(userMap.get(r.unassignedBy)) : null,
      note: r.note,
    }));
  }

  /** Active RVSK_SPOC users for the assignment picker. */
  async listSpocUsers(): Promise<
    { id: string; name: string; email: string | null }[]
  > {
    const spocs = await this.userRepo.find({
      // role is resolved via the portal_role relation (role_code is the key).
      where: { rolePortal: { roleCode: RoleConstants.RVSK_SPOC }, isActive: true },
      order: { displayName: 'ASC' },
    });
    return spocs.map((u) => ({
      id: u.id,
      name: u.displayName || u.username,
      email: u.contactEmail || u.userEmail || null,
    }));
  }

  // ==================== WRITE ====================

  /**
   * Assign one or more States to a SPOC. Any State already owned by a different
   * SPOC is transparently reassigned. Runs in a single transaction.
   */
  async assignStates(
    adminId: string,
    spocUserId: string,
    stateKeys: string[],
    note?: string,
  ): Promise<AssignmentRow[]> {
    // Reject duplicate state keys within the request (Req 3.6).
    const unique = new Set(stateKeys);
    if (unique.size !== stateKeys.length) {
      throw new AppException(
        'Duplicate states in a single assignment request are not allowed.',
        HttpStatus.BAD_REQUEST,
        'DUPLICATE_STATE_IN_REQUEST',
      );
    }

    const spoc = await this.validateSpoc(spocUserId);

    // Validate all states up-front so the whole request is all-or-nothing.
    const stateInfos = new Map<string, { stateName: string | null }>();
    for (const stateKey of stateKeys) {
      stateInfos.set(stateKey, await this.validateState(stateKey));
    }

    // Collect post-commit notification intents so mail fires after the txn.
    const notifyIntents: Array<{
      isReassign: boolean;
      stateKey: string;
      stateName: string | null;
      newSpocId: string;
      previousSpocId: string | null;
    }> = [];

    await this.dataSource.transaction(async (manager) => {
      for (const stateKey of stateKeys) {
        const existing = await manager.findOne(StateSpocMapping, {
          where: { stateKey, isActive: true },
        });

        // No-op if already actively mapped to the same SPOC (Req 4.6).
        if (existing && existing.spocUserId === spocUserId) {
          continue;
        }

        if (existing) {
          existing.isActive = false;
          existing.unassignedAt = new Date();
          existing.unassignedBy = adminId;
          await manager.save(existing);
        }

        const row = new StateSpocMapping();
        row.id = uuidv4();
        row.stateKey = stateKey;
        row.spocUserId = spocUserId;
        row.isActive = true;
        row.assignedAt = new Date();
        row.assignedBy = adminId;
        row.note = note ?? null;
        await manager.save(row);

        // Option 1b — refresh current-owner snapshot + append REASSIGNED history
        // for this State's non-terminal grievances (existing history untouched).
        await this.refreshGrievanceOwnership(
          manager,
          stateKey,
          existing ? existing.spocUserId : null,
          spocUserId,
          adminId,
        );

        notifyIntents.push({
          isReassign: !!existing,
          stateKey,
          stateName: stateInfos.get(stateKey)?.stateName ?? null,
          newSpocId: spocUserId,
          previousSpocId: existing ? existing.spocUserId : null,
        });
      }
    });

    // Audit + notifications (post-commit, non-blocking).
    for (const intent of notifyIntents) {
      await this.auditAndNotify(adminId, spoc, intent);
    }

    return this.listAssignments();
  }

  /** Reassign a single State (convenience wrapper). */
  async reassignState(
    adminId: string,
    stateKey: string,
    spocUserId: string,
    note?: string,
  ): Promise<AssignmentRow[]> {
    return this.assignStates(adminId, spocUserId, [stateKey], note);
  }

  /** Retire a State's active mapping (leaves its grievances unassigned). */
  async deactivateState(
    adminId: string,
    stateKey: string,
    note?: string,
  ): Promise<AssignmentRow[]> {
    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(StateSpocMapping, {
        where: { stateKey, isActive: true },
      });
      if (!existing) {
        throw new AppException(
          'No active SPOC mapping for this state.',
          HttpStatus.NOT_FOUND,
          'NO_ACTIVE_MAPPING',
        );
      }
      existing.isActive = false;
      existing.unassignedAt = new Date();
      existing.unassignedBy = adminId;
      if (note) existing.note = note;
      await manager.save(existing);

      // Clear current-owner snapshot on non-terminal grievances of this state.
      await this.refreshGrievanceOwnership(
        manager,
        stateKey,
        existing.spocUserId,
        null,
        adminId,
      );
    });

    return this.listAssignments();
  }

  // ==================== internals ====================

  /**
   * Option 1b: for non-terminal grievances of a State, set assigned_to to the
   * new SPOC (or null on deactivation) and append a REASSIGNED history row.
   * CLOSED grievances and all existing history/responses are left untouched.
   */
  private async refreshGrievanceOwnership(
    manager: import('typeorm').EntityManager,
    stateKey: string,
    fromSpocId: string | null,
    toSpocId: string | null,
    adminId: string,
  ): Promise<void> {
    const grievances = await manager.find(Grievance, {
      where: { stateKey, status: In(NON_TERMINAL_STATUSES) },
    });
    for (const g of grievances) {
      const prev = g.assignedTo;
      if (prev === toSpocId) continue; // nothing to change
      g.assignedTo = toSpocId;
      await manager.save(g);

      const history = new GrievanceHistory();
      history.id = uuidv4();
      history.grievanceId = g.id;
      history.action = 'REASSIGNED';
      history.comment = toSpocId
        ? `Ownership moved (state reassigned) from ${fromSpocId ?? 'unassigned'} to ${toSpocId}`
        : `Ownership cleared (state SPOC mapping deactivated); was ${fromSpocId ?? 'unassigned'}`;
      history.performedBy = adminId;
      await manager.save(history);
    }
  }

  /** Post-commit audit trail + email notification for one assignment intent. */
  private async auditAndNotify(
    adminId: string,
    spoc: PortalUser,
    intent: {
      isReassign: boolean;
      stateKey: string;
      stateName: string | null;
      newSpocId: string;
      previousSpocId: string | null;
    },
  ): Promise<void> {
    const adminName = this.nameOf(
      (await this.resolveUsers([adminId])).get(adminId),
    );

    // Audit trail (non-blocking).
    await this.auditService.recordAndLog(
      {
        entityName: 'STATE_SPOC_MAPPING',
        entityId: intent.stateKey,
        actionType: intent.isReassign ? 'REASSIGN' : 'ASSIGN',
        userId: adminId,
        oldValues: intent.previousSpocId
          ? { spocUserId: intent.previousSpocId }
          : undefined,
        newValues: { spocUserId: intent.newSpocId, stateKey: intent.stateKey },
      },
      {
        module: 'GRIEVANCES',
        action: intent.isReassign ? 'SPOC_REASSIGN' : 'SPOC_ASSIGN',
        description: `State ${intent.stateName ?? intent.stateKey} ${
          intent.isReassign ? 'reassigned' : 'assigned'
        } to SPOC ${spoc.displayName || spoc.username}`,
        performedBy: adminId,
        entityId: intent.stateKey,
      },
    );

    const eventCode = intent.isReassign
      ? 'SPOC_STATE_REASSIGNED'
      : 'SPOC_STATE_ASSIGNED';

    // Notify the new SPOC.
    const newEmail = spoc.contactEmail || spoc.userEmail || '';
    let previousSpocName = '';
    if (intent.previousSpocId) {
      previousSpocName = this.nameOf(
        (await this.resolveUsers([intent.previousSpocId])).get(
          intent.previousSpocId,
        ),
      ) ?? '';
    }
    if (newEmail) {
      await this.notificationService.notify(eventCode, {
        to: newEmail,
        referenceType: 'STATE_SPOC',
        referenceId: `${intent.stateKey}:${intent.newSpocId}:${Date.now()}`,
        data: {
          spoc_name: spoc.displayName || spoc.username,
          state_name: intent.stateName ?? intent.stateKey,
          assigned_by_name: adminName ?? 'Administrator',
          previous_spoc_name: previousSpocName,
          previous_spoc_clause: previousSpocName
            ? ` (previously handled by ${previousSpocName})`
            : '',
        },
      });
    }

    // Awareness copy to the previous SPOC on reassignment.
    if (intent.isReassign && intent.previousSpocId) {
      const prev = await this.userRepo.findOne({
        where: { id: intent.previousSpocId },
      });
      const prevEmail = prev?.contactEmail || prev?.userEmail || '';
      if (prev && prevEmail) {
        await this.notificationService.notify('SPOC_STATE_REASSIGNED', {
          to: prevEmail,
          referenceType: 'STATE_SPOC',
          referenceId: `${intent.stateKey}:prev:${intent.previousSpocId}:${Date.now()}`,
          data: {
            spoc_name: prev.displayName || prev.username,
            state_name: intent.stateName ?? intent.stateKey,
            assigned_by_name: adminName ?? 'Administrator',
            previous_spoc_name: prev.displayName || prev.username,
            previous_spoc_clause: '',
          },
        });
      }
    }
  }

  /** Validate the target user is an active RVSK_SPOC. */
  private async validateSpoc(spocUserId: string): Promise<PortalUser> {
    const spoc = await this.userRepo.findOne({ where: { id: spocUserId } });
    if (!spoc) {
      throw new AppException(
        'SPOC user not found.',
        HttpStatus.BAD_REQUEST,
        'SPOC_NOT_FOUND',
      );
    }
    if (spoc.role !== RoleConstants.RVSK_SPOC) {
      throw new AppException(
        'Selected user is not an RVSK SPOC.',
        HttpStatus.BAD_REQUEST,
        'NOT_A_SPOC',
      );
    }
    if (!spoc.isActive) {
      throw new AppException(
        'Cannot assign states to a deactivated SPOC.',
        HttpStatus.BAD_REQUEST,
        'SPOC_INACTIVE',
      );
    }
    return spoc;
  }

  /** Validate the state key exists in the master view; return its name. */
  private async validateState(
    stateKey: string,
  ): Promise<{ stateName: string | null }> {
    const rows = await this.dataSource.query(
      `SELECT state_name FROM rvsk_portal.vw_state_master WHERE state_key = $1`,
      [stateKey],
    );
    if (!rows.length) {
      throw new AppException(
        `Unknown state key: ${stateKey}`,
        HttpStatus.BAD_REQUEST,
        'UNKNOWN_STATE',
      );
    }
    return { stateName: rows[0].state_name ?? null };
  }

  private async resolveUsers(ids: string[]): Promise<Map<string, PortalUser>> {
    const map = new Map<string, PortalUser>();
    if (!ids.length) return map;
    try {
      const users = await this.userRepo.find({ where: { id: In(ids) } });
      users.forEach((u) => map.set(u.id, u));
    } catch (err: any) {
      this.logger.warn(`Failed to resolve users: ${err?.message || err}`);
    }
    return map;
  }

  private nameOf(u?: PortalUser | null): string | null {
    if (!u) return null;
    return u.displayName || u.username || null;
  }
}

import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppException, PageResponse, RoleConstants } from '@rvsk/common';
import { Grievance } from './entities/grievance.entity';
import { GrievanceResponse } from './entities/grievance-response.entity';
import { GrievanceHistory } from './entities/grievance-history.entity';
import { PortalUser } from '../auth/entities/portal-user.entity';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class GrievanceService {
  private readonly logger = new Logger(GrievanceService.name);

  /**
   * Allowed status transitions map.
   */
  private readonly ALLOWED_TRANSITIONS: Record<string, string[]> = {
    OPEN: ['ASSIGNED'],
    ASSIGNED: ['UNDER_REVIEW'],
    UNDER_REVIEW: ['IN_PROGRESS'],
    IN_PROGRESS: ['RESPONSE_PROVIDED'],
    RESPONSE_PROVIDED: ['CLOSED', 'REOPENED'],
    REOPENED: ['UNDER_REVIEW'],
  };

  constructor(
    @InjectRepository(Grievance)
    private readonly grievanceRepo: Repository<Grievance>,
    @InjectRepository(GrievanceResponse)
    private readonly responseRepo: Repository<GrievanceResponse>,
    @InjectRepository(GrievanceHistory)
    private readonly historyRepo: Repository<GrievanceHistory>,
    @InjectRepository(PortalUser)
    private readonly userRepo: Repository<PortalUser>,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
  ) {}

  /** Resolve a user's notification email (contact_email fallback user_email). */
  private async emailForUser(userId: string | null): Promise<{
    email: string;
    name: string;
  } | null> {
    if (!userId) {
      return null;
    }
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) {
      return null;
    }
    const email = u.contactEmail || u.userEmail || '';
    if (!email) {
      return null;
    }
    return { email, name: u.displayName || u.username };
  }

  /**
   * Creates a new grievance with auto-generated ID and optional auto-assignment to RVSK_SPOC.
   */
  async createGrievance(
    userId: string,
    stateCode: string,
    districtCode: string,
    category: string,
    subCategory: string,
    subject: string,
    description: string,
  ): Promise<Record<string, any>> {
    let grievanceId: string;
    try {
      grievanceId = await this.generateGrievanceId(stateCode);
    } catch (err: any) {
      this.logger.error(`generateGrievanceId failed: ${err?.message}`);
      grievanceId = `GRV-${stateCode || 'XX'}-${Date.now()}`;
    }

    const grievance = new Grievance();
    grievance.id = uuidv4();
    grievance.grievanceId = grievanceId;
    grievance.createdBy = userId;
    grievance.stateCode = stateCode;
    grievance.districtCode = districtCode;
    grievance.category = category;
    grievance.subCategory = subCategory;
    grievance.subject = subject;
    grievance.description = description;
    grievance.status = 'OPEN';

    // Auto-assign to RVSK_SPOC mapped to creator's stateCode
    let spoc = null;
    try {
      spoc = await this.findSpocForState(stateCode);
    } catch (err: any) {
      // SPOC lookup may fail due to entity/table mismatch - proceed without assignment
      this.logger.warn(`SPOC lookup failed for state ${stateCode}: ${err?.message || err}. Proceeding without auto-assignment.`);
    }
    if (spoc) {
      grievance.assignedTo = spoc.id;
      grievance.status = 'ASSIGNED';
      this.logger.log(`Auto-assigned grievance ${grievanceId} to SPOC ${spoc.id}`);
    }

    let saved;
    try {
      saved = await this.grievanceRepo.save(grievance);
    } catch (err: any) {
      this.logger.error(`Failed to save grievance: ${err?.message || err}`);
      throw err;
    }

    // Record creation in history (non-blocking — don't fail grievance creation if history table has issues)
    try {
      const history = new GrievanceHistory();
      history.id = uuidv4();
      history.grievanceId = saved.id;
      history.action = 'CREATED';
      history.comment = `Grievance created with status ${saved.status}`;
      history.performedBy = userId;
      await this.historyRepo.save(history);
    } catch (err: any) {
      this.logger.warn(`Failed to save grievance history: ${err?.message || err}. Grievance was created successfully.`);
    }

    // Audit trail + dashboard feed (non-blocking).
    await this.auditService.recordAndLog(
      {
        entityName: 'GRIEVANCE',
        entityId: saved.id,
        actionType: 'CREATE',
        userId,
        userStateCode: stateCode,
        newValues: {
          grievanceId: saved.grievanceId,
          category: saved.category,
          status: saved.status,
        },
      },
      {
        module: 'GRIEVANCES',
        action: 'CREATE',
        description: `Grievance ${saved.grievanceId} created`,
        performedBy: userId,
        entityId: saved.id,
        stateCode,
      },
    );

    // RVSK-NOTIFY-EMAIL-003: notify the assigned SPOC (non-blocking).
    if (spoc) {
      const spocEmail = spoc.contactEmail || spoc.userEmail || '';
      if (spocEmail) {
        const data = {
          spoc_name: spoc.displayName || spoc.username,
          grievance_id: saved.grievanceId,
          grievance_subject: saved.subject,
          state_name: spoc.stateName || stateCode,
        };
        await this.notificationService.notify('GRIEVANCE_CREATED', {
          to: spocEmail,
          referenceType: 'GRIEVANCE',
          referenceId: saved.id,
          data,
        });
        await this.notificationService.notify('GRIEVANCE_ASSIGNED_TO_SPOC', {
          to: spocEmail,
          referenceType: 'GRIEVANCE',
          referenceId: saved.id,
          data,
        });
      }
    }

    return {
      id: saved.id,
      grievanceId: saved.grievanceId,
      status: saved.status,
      assignedTo: saved.assignedTo,
      createdAt: saved.createdAt,
    };
  }

  /**
   * Lists grievances with role-based scope filtering, search, status/category filters, and pagination.
   */
  async listGrievances(
    userId: string,
    role: string,
    stateCode: string,
    search?: string,
    status?: string,
    category?: string,
    page: number = 0,
    size: number = 20,
  ): Promise<PageResponse<Grievance>> {
    // Enforce max page size
    const effectiveSize = Math.min(Math.max(size, 1), 100);

    const qb: SelectQueryBuilder<Grievance> = this.grievanceRepo
      .createQueryBuilder('g')
      .orderBy('g.createdAt', 'DESC');

    // Role-based scope filtering
    this.applyRoleScope(qb, userId, role, stateCode);

    // Apply search filter (case-insensitive partial match on subject or grievanceId)
    if (search) {
      qb.andWhere(
        '(LOWER(g.subject) LIKE LOWER(:search) OR LOWER(g.grievanceId) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    // Apply status filter
    if (status) {
      qb.andWhere('g.status = :status', { status });
    }

    // Apply category filter
    if (category) {
      qb.andWhere('g.category = :category', { category });
    }

    // Get total count
    const totalElements = await qb.getCount();

    // Apply pagination
    const content = await qb
      .skip(page * effectiveSize)
      .take(effectiveSize)
      .getMany();

    return new PageResponse<Grievance>(content, totalElements, page, effectiveSize);
  }

  /**
   * Gets full grievance detail including responses and history.
   */
  async getGrievanceDetail(
    id: string,
    userId: string,
    role: string,
  ): Promise<Record<string, any>> {
    const grievance = await this.grievanceRepo.findOne({ where: { id } });

    if (!grievance) {
      return null;
    }

    const responses = await this.responseRepo.find({
      where: { grievanceId: id },
      order: { createdAt: 'DESC' },
    });

    const history = await this.historyRepo.find({
      where: { grievanceId: id },
      order: { createdAt: 'DESC' },
    });

    return {
      ...grievance,
      responses,
      history,
    };
  }

  /**
   * Aggregates dashboard KPIs with role-based scope filtering.
   */
  async getDashboard(
    userId: string,
    role: string,
    stateCode: string,
  ): Promise<Record<string, number>> {
    const qb = this.grievanceRepo.createQueryBuilder('g');
    this.applyRoleScope(qb, userId, role, stateCode);

    const total = await qb.getCount();

    // Re-create query for grouped counts (TypeORM requires separate builder for select+group)
    const scopedQb = this.grievanceRepo.createQueryBuilder('g');
    this.applyRoleScope(scopedQb, userId, role, stateCode);
    const rawCounts = await scopedQb
      .select('g.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('g.status')
      .getRawMany();

    const kpis: Record<string, number> = {
      total,
      open: 0,
      assigned: 0,
      underReview: 0,
      inProgress: 0,
      responseProvided: 0,
      closed: 0,
      reopened: 0,
    };

    for (const row of rawCounts) {
      const status = row.status;
      const count = parseInt(row.count, 10);
      switch (status) {
        case 'OPEN': kpis.open = count; break;
        case 'ASSIGNED': kpis.assigned = count; break;
        case 'UNDER_REVIEW': kpis.underReview = count; break;
        case 'IN_PROGRESS': kpis.inProgress = count; break;
        case 'RESPONSE_PROVIDED': kpis.responseProvided = count; break;
        case 'CLOSED': kpis.closed = count; break;
        case 'REOPENED': kpis.reopened = count; break;
      }
    }

    return kpis;
  }

  /**
   * Counts grievances with pending action for the user.
   */
  async getNotificationCount(userId: string, role: string): Promise<number> {
    const qb = this.grievanceRepo.createQueryBuilder('g');

    if (role === RoleConstants.RVSK_SPOC) {
      // SPOC sees assigned/in-progress grievances as pending
      qb.where('g.assignedTo = :userId', { userId })
        .andWhere('g.status IN (:...statuses)', {
          statuses: ['ASSIGNED', 'UNDER_REVIEW', 'IN_PROGRESS', 'REOPENED'],
        });
    } else if (
      role === RoleConstants.SUPER_ADMIN ||
      role === RoleConstants.RVSK_ADMIN
    ) {
      // Admin sees unassigned grievances as pending
      qb.where('g.status = :status', { status: 'OPEN' });
    } else {
      // Regular users see grievances with responses to review
      qb.where('g.createdBy = :userId', { userId })
        .andWhere('g.status = :status', { status: 'RESPONSE_PROVIDED' });
    }

    return qb.getCount();
  }

  /**
   * Updates grievance status with validation against allowed transitions.
   * Records the transition in grievance history.
   */
  async updateStatus(
    id: string,
    newStatus: string,
    userId: string,
    comment?: string,
  ): Promise<Grievance> {
    const grievance = await this.grievanceRepo.findOne({ where: { id } });

    if (!grievance) {
      throw new AppException(
        'Grievance not found',
        HttpStatus.NOT_FOUND,
        'GRIEVANCE_NOT_FOUND',
      );
    }

    const allowedNext = this.ALLOWED_TRANSITIONS[grievance.status] || [];
    if (!allowedNext.includes(newStatus)) {
      throw new AppException(
        `Status transition from ${grievance.status} to ${newStatus} is not allowed`,
        HttpStatus.BAD_REQUEST,
        'INVALID_STATUS_TRANSITION',
      );
    }

    grievance.status = newStatus;
    const saved = await this.grievanceRepo.save(grievance);

    // Record status change in history
    const history = new GrievanceHistory();
    history.id = uuidv4();
    history.grievanceId = id;
    history.action = 'STATUS_CHANGED';
    history.comment = comment || `Status changed to ${newStatus}`;
    history.performedBy = userId;
    await this.historyRepo.save(history);

    const isAssign = newStatus === 'ASSIGNED';
    await this.auditService.recordAndLog(
      {
        entityName: 'GRIEVANCE',
        entityId: id,
        actionType: isAssign ? 'ASSIGN' : 'STATUS_CHANGE',
        userId,
        userStateCode: grievance.stateCode,
        oldValues: { status: grievance.status },
        newValues: { status: newStatus },
      },
      {
        module: 'GRIEVANCES',
        action: isAssign ? 'ASSIGN' : 'STATUS_CHANGE',
        description: `Grievance ${grievance.grievanceId} status changed to ${newStatus}`,
        performedBy: userId,
        entityId: id,
        stateCode: grievance.stateCode,
      },
    );

    this.logger.log(`Grievance ${grievance.grievanceId} status changed to ${newStatus} by ${userId}`);
    return saved;
  }

  /**
   * Adds a response to a grievance and records it in history.
   */
  async addResponse(
    id: string,
    responseText: string,
    userId: string,
  ): Promise<GrievanceResponse> {
    const grievance = await this.grievanceRepo.findOne({ where: { id } });

    if (!grievance) {
      throw new AppException(
        'Grievance not found',
        HttpStatus.NOT_FOUND,
        'GRIEVANCE_NOT_FOUND',
      );
    }

    const response = new GrievanceResponse();
    response.id = uuidv4();
    response.grievanceId = id;
    response.responseText = responseText;
    response.respondedBy = userId;

    const saved = await this.responseRepo.save(response);

    // Record in history
    const history = new GrievanceHistory();
    history.id = uuidv4();
    history.grievanceId = id;
    history.action = 'RESPONSE_ADDED';
    history.comment = `Response added by ${userId}`;
    history.performedBy = userId;
    await this.historyRepo.save(history);

    this.logger.log(`Response added to grievance ${grievance.grievanceId} by ${userId}`);
    return saved;
  }

  /**
   * Adds an internal note to a grievance (visible only to admins/SPOCs).
   */
  async addInternalNote(
    id: string,
    note: string,
    userId: string,
  ): Promise<GrievanceHistory> {
    const history = new GrievanceHistory();
    history.id = uuidv4();
    history.grievanceId = id;
    history.action = 'INTERNAL_NOTE';
    history.comment = note;
    history.performedBy = userId;

    const saved = await this.historyRepo.save(history);
    this.logger.log(`Internal note added to grievance ${id} by ${userId}`);
    return saved;
  }

  /**
   * Reopens a grievance that has status RESPONSE_PROVIDED.
   * Sets status to REOPENED and clears resolvedAt.
   */
  async reopen(
    id: string,
    userId: string,
    reason?: string,
  ): Promise<Grievance> {
    const grievance = await this.grievanceRepo.findOne({ where: { id } });

    if (!grievance) {
      throw new AppException(
        'Grievance not found',
        HttpStatus.NOT_FOUND,
        'GRIEVANCE_NOT_FOUND',
      );
    }

    if (grievance.status !== 'RESPONSE_PROVIDED') {
      throw new AppException(
        'Grievance is not in a valid state for reopening. Status must be RESPONSE_PROVIDED.',
        HttpStatus.BAD_REQUEST,
        'INVALID_STATE_FOR_REOPEN',
      );
    }

    grievance.status = 'REOPENED';
    grievance.resolvedAt = null;
    const saved = await this.grievanceRepo.save(grievance);

    // Record in history with reason
    const history = new GrievanceHistory();
    history.id = uuidv4();
    history.grievanceId = id;
    history.action = 'STATUS_CHANGED';
    history.comment = reason || 'Grievance reopened';
    history.performedBy = userId;
    await this.historyRepo.save(history);

    this.logger.log(`Grievance ${grievance.grievanceId} reopened by ${userId}`);

    // RVSK-NOTIFY-EMAIL-003: GRIEVANCE_REOPENED → assigned SPOC.
    const spoc = await this.emailForUser(saved.assignedTo ?? null);
    if (spoc) {
      await this.notificationService.notify('GRIEVANCE_REOPENED', {
        to: spoc.email,
        referenceType: 'GRIEVANCE',
        referenceId: `${saved.id}:reopen:${Date.now()}`,
        data: {
          spoc_name: spoc.name,
          grievance_id: saved.grievanceId,
          grievance_subject: saved.subject,
        },
      });
    }

    return saved;
  }

  /**
   * Closes a grievance that has status RESPONSE_PROVIDED.
   * Sets status to CLOSED and records resolvedAt timestamp.
   */
  async close(
    id: string,
    userId: string,
    comment?: string,
  ): Promise<Grievance> {
    const grievance = await this.grievanceRepo.findOne({ where: { id } });

    if (!grievance) {
      throw new AppException(
        'Grievance not found',
        HttpStatus.NOT_FOUND,
        'GRIEVANCE_NOT_FOUND',
      );
    }

    if (grievance.status !== 'RESPONSE_PROVIDED') {
      throw new AppException(
        'Grievance is not in a valid state for closing. Status must be RESPONSE_PROVIDED.',
        HttpStatus.BAD_REQUEST,
        'INVALID_STATE_FOR_CLOSE',
      );
    }

    grievance.status = 'CLOSED';
    grievance.resolvedAt = new Date();
    const saved = await this.grievanceRepo.save(grievance);

    // Record in history
    const history = new GrievanceHistory();
    history.id = uuidv4();
    history.grievanceId = id;
    history.action = 'STATUS_CHANGED';
    history.comment = comment || 'Grievance closed';
    history.performedBy = userId;
    await this.historyRepo.save(history);

    await this.auditService.recordAndLog(
      {
        entityName: 'GRIEVANCE',
        entityId: id,
        actionType: 'CLOSE',
        userId,
        userStateCode: grievance.stateCode,
        oldValues: { status: 'RESPONSE_PROVIDED' },
        newValues: { status: 'CLOSED', resolvedAt: saved.resolvedAt },
      },
      {
        module: 'GRIEVANCES',
        action: 'CLOSE',
        description: `Grievance ${grievance.grievanceId} closed`,
        performedBy: userId,
        entityId: id,
        stateCode: grievance.stateCode,
      },
    );

    this.logger.log(`Grievance ${grievance.grievanceId} closed by ${userId}`);

    // RVSK-NOTIFY-EMAIL-003: GRIEVANCE_CLOSED → grievance creator.
    const creator = await this.emailForUser(saved.createdBy ?? null);
    if (creator) {
      await this.notificationService.notify('GRIEVANCE_CLOSED', {
        to: creator.email,
        referenceType: 'GRIEVANCE',
        referenceId: `${saved.id}:close:${Date.now()}`,
        data: {
          user_name: creator.name,
          grievance_id: saved.grievanceId,
          grievance_subject: saved.subject,
        },
      });
    }

    return saved;
  }

  /**
   * Generates a unique grievance ID in format: GRV-{STATE_CODE}-{YYYYMMDD}-{SEQ}
   * SEQ is a 4-digit zero-padded sequence number based on today's grievances.
   */
  private async generateGrievanceId(stateCode: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `GRV-${stateCode || 'XX'}-${dateStr}`;

    let count = 0;
    try {
      // Count today's grievances to determine next sequence
      count = await this.grievanceRepo
        .createQueryBuilder('g')
        .where('g.grievanceId LIKE :prefix', { prefix: `${prefix}%` })
        .getCount();
    } catch (err: any) {
      this.logger.warn(`Failed to count grievances for sequence: ${err?.message || err}. Using random sequence.`);
      count = Math.floor(Math.random() * 9000);
    }

    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}-${seq}`;
  }

  /**
   * Finds the active RVSK_SPOC with the lowest assigned grievance count for load balancing.
   * If multiple SPOCs exist for a state, assigns to the one with fewest open tickets.
   */
  private async findSpocForState(stateCode: string): Promise<PortalUser | null> {
    if (!stateCode) {
      return null;
    }

    // Grievances carry the legacy 2-char state code (== vw_state_master.state_id).
    // Portal users now scope by state_key (bigint), so resolve the key first.
    const stateRows = await this.userRepo.manager.query(
      `SELECT state_key FROM rvsk_portal.vw_state_master WHERE state_id = $1`,
      [stateCode],
    );
    if (!stateRows.length) {
      return null;
    }
    const stateKey = String(stateRows[0].state_key);

    // Get all active SPOCs for this state
    const spocs = await this.userRepo.find({
      where: {
        role: RoleConstants.RVSK_SPOC,
        stateKey,
        isActive: true,
      },
    });

    if (spocs.length === 0) {
      return null;
    }

    if (spocs.length === 1) {
      return spocs[0];
    }

    // Load balance: find SPOC with fewest active grievances (not CLOSED)
    let leastLoadedSpoc = spocs[0];
    let minCount = Number.MAX_SAFE_INTEGER;

    for (const spoc of spocs) {
      const count = await this.grievanceRepo
        .createQueryBuilder('g')
        .where('g.assignedTo = :spocId', { spocId: spoc.id })
        .andWhere('g.status NOT IN (:...closedStatuses)', {
          closedStatuses: ['CLOSED'],
        })
        .getCount();

      if (count < minCount) {
        minCount = count;
        leastLoadedSpoc = spoc;
      }
    }

    this.logger.log(`Load-balanced assignment: SPOC ${leastLoadedSpoc.id} has ${minCount} active grievances`);
    return leastLoadedSpoc;
  }

  /**
   * Applies role-based scope filtering to a query builder.
   * - Super_Admin / RVSK_Admin → no filter (all grievances)
   * - RVSK_SPOC → WHERE assignedTo = userId
   * - State_Admin / State_SPOC → WHERE stateCode = user's stateCode
   * - Others (District_Admin) → WHERE createdBy = userId
   */
  private applyRoleScope(
    qb: SelectQueryBuilder<Grievance>,
    userId: string,
    role: string,
    stateCode?: string,
  ): void {
    if (
      role === RoleConstants.SUPER_ADMIN ||
      role === RoleConstants.RVSK_ADMIN
    ) {
      // No scope filter — admins see all grievances
      return;
    }

    if (role === RoleConstants.RVSK_SPOC) {
      qb.andWhere('g.assignedTo = :userId', { userId });
    } else if (role === RoleConstants.STATE_ADMIN || role === RoleConstants.STATE_SPOC) {
      // State-level users see all grievances from their state
      if (stateCode) {
        qb.andWhere('g.stateCode = :stateCode', { stateCode });
      } else {
        qb.andWhere('g.createdBy = :userId', { userId });
      }
    } else {
      // District_Admin and other roles see only their own
      qb.andWhere('g.createdBy = :userId', { userId });
    }
  }
}

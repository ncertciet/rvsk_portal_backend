import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PortalUser } from '../auth/entities/portal-user.entity';
import { Grievance } from '../grievance/entities/grievance.entity';
import { FormMaster } from '../forms/entities/form-master.entity';
import { ActivityLogEntry } from '../audit/entities/activity-log.entity';

export interface HomeData {
  // Super Admin fields
  totalUsers?: number;
  activeUsers?: number;
  totalForms?: number;
  totalGrievances?: number;
  activeServices?: number;
  recentActivities?: any[];

  // RVSK Admin fields
  formsSent?: number;
  formsPublished?: number;
  responsesReceived?: number;

  // State Admin fields
  pendingCount?: number;
  draftCount?: number;
  submittedCount?: number;
  assignedForms?: any[];

  // SPOC fields
  openGrievances?: number;
  inProgressGrievances?: number;
  resolvedGrievances?: number;
  pendingActions?: any[];
}

@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);

  constructor(
    @InjectRepository(PortalUser)
    private readonly userRepo: Repository<PortalUser>,
    @InjectRepository(Grievance)
    private readonly grievanceRepo: Repository<Grievance>,
    @InjectRepository(FormMaster)
    private readonly formRepo: Repository<FormMaster>,
    @InjectRepository(ActivityLogEntry)
    private readonly activityRepo: Repository<ActivityLogEntry>,
  ) {}

  /**
   * Fetch the most recent activity-feed entries for the Super Admin / RVSK
   * Admin dashboard. Unfiltered (all roles, all states), newest first, joined
   * to portal_users to resolve a human-readable actor name.
   * Non-blocking: returns [] on any failure so the dashboard still renders.
   */
  private async getRecentActivities(limit = 15): Promise<any[]> {
    try {
      const rows = await this.activityRepo
        .createQueryBuilder('a')
        .leftJoin(PortalUser, 'u', 'u.id = a.performedBy')
        .select([
          'a.id AS id',
          'a.module AS module',
          'a.action AS action',
          'a.description AS description',
          'a.performedBy AS "performedById"',
          'a.performedAt AS "performedAt"',
          'COALESCE(u.display_name, u.username) AS "performedBy"',
        ])
        .orderBy('a.performedAt', 'DESC')
        .limit(limit)
        .getRawMany();

      return rows.map((r) => ({
        id: r.id,
        module: r.module,
        action: r.action,
        description: r.description,
        performedBy: r.performedBy || 'System',
        performedAt: r.performedAt,
      }));
    } catch (e: any) {
      this.logger.warn(`Recent activity fetch failed: ${e?.message ?? e}`);
      return [];
    }
  }

  /**
   * Get aggregated home page data for the dashboard.
   * Returns role-specific data shapes.
   */
  async getHomeData(userId: string, role: string, stateCode: string): Promise<HomeData> {
    this.logger.debug(`Fetching home data for user=${userId}, role=${role}, stateCode=${stateCode}`);

    switch (role) {
      case 'Super_Admin':
      case 'RVSK_Admin':
        return this.getSuperAdminData(role);
      case 'RVSK_SPOC':
        return this.getSpocData(userId);
      case 'State_Admin':
        return this.getStateAdminData(stateCode);
      default:
        return this.getDefaultData();
    }
  }

  private async getSuperAdminData(role: string): Promise<HomeData> {
    let totalUsers = 0;
    let totalForms = 0;
    let totalGrievances = 0;
    let formsPublished = 0;

    try {
      totalUsers = await this.userRepo.count();
    } catch (e: any) {
      this.logger.warn(`User count failed: ${e?.message}`);
    }

    try {
      totalForms = await this.formRepo.count();
      formsPublished = await this.formRepo.count({ where: { status: 'PUBLISHED' } });
    } catch (e: any) {
      this.logger.warn(`Form count failed: ${e?.message}`);
    }

    try {
      totalGrievances = await this.grievanceRepo.count();
    } catch (e: any) {
      this.logger.warn(`Grievance count failed: ${e?.message}`);
    }

    // Super Admin and RVSK Admin both see the global activity feed (all roles).
    const recentActivities = await this.getRecentActivities();

    if (role === 'RVSK_Admin') {
      return {
        formsSent: totalForms,
        formsPublished,
        responsesReceived: 0,
        recentActivities,
      };
    }

    return {
      totalUsers,
      totalForms,
      totalGrievances,
      activeServices: 6,
      recentActivities,
    };
  }

  private async getSpocData(userId: string): Promise<HomeData> {
    let openGrievances = 0;
    let inProgressGrievances = 0;
    let resolvedGrievances = 0;

    try {
      openGrievances = await this.grievanceRepo
        .createQueryBuilder('g')
        .where('g.assignedTo = :userId', { userId })
        .andWhere('g.status IN (:...statuses)', { statuses: ['ASSIGNED', 'REOPENED'] })
        .getCount();

      inProgressGrievances = await this.grievanceRepo
        .createQueryBuilder('g')
        .where('g.assignedTo = :userId', { userId })
        .andWhere('g.status IN (:...statuses)', { statuses: ['UNDER_REVIEW', 'IN_PROGRESS'] })
        .getCount();

      resolvedGrievances = await this.grievanceRepo
        .createQueryBuilder('g')
        .where('g.assignedTo = :userId', { userId })
        .andWhere('g.status IN (:...statuses)', { statuses: ['RESPONSE_PROVIDED', 'CLOSED'] })
        .getCount();
    } catch (e: any) {
      this.logger.warn(`SPOC grievance counts failed: ${e?.message}`);
    }

    return {
      openGrievances,
      inProgressGrievances,
      resolvedGrievances,
      pendingActions: [],
    };
  }

  private async getStateAdminData(stateCode: string): Promise<HomeData> {
    // State admin sees their assigned forms
    let pendingCount = 0;
    let draftCount = 0;
    let submittedCount = 0;

    try {
      // These would query FormAssignment table by stateCode
      // For now return placeholder counts
      pendingCount = 0;
      draftCount = 0;
      submittedCount = 0;
    } catch (e: any) {
      this.logger.warn(`State admin data failed: ${e?.message}`);
    }

    return {
      pendingCount,
      draftCount,
      submittedCount,
      assignedForms: [],
    };
  }

  private async getDefaultData(): Promise<HomeData> {
    return {
      totalUsers: 0,
      totalForms: 0,
      totalGrievances: 0,
      activeServices: 0,
      recentActivities: [],
    };
  }
}

import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { AppException } from '@rvsk/common';

import { PortalRole } from './entities/portal-role.entity';
import { CreateRoleDto, RoleDto, UpdateRoleDto } from './dto/role.dto';

/**
 * RVSK-RBAC-ROLE-002-A — Roles master service.
 *
 * Owns CRUD over the portal_role master. The role_code remains the stable
 * authorization key; nothing here changes how requests are authorized — it
 * only manages the catalog that the frontend consumes and that
 * portal_users.role_id references.
 */
@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(PortalRole)
    private readonly roleRepo: Repository<PortalRole>,
  ) {}

  // ==================== READ ====================

  /** List roles. `activeOnly=true` returns only active roles (frontend use). */
  async listRoles(activeOnly = false): Promise<RoleDto[]> {
    const where = activeOnly ? { isActive: true } : {};
    const roles = await this.roleRepo.find({
      where,
      order: { roleName: 'ASC' },
    });
    return roles.map((r) => this.toDto(r));
  }

  async getRoleById(id: string): Promise<RoleDto> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new AppException('Role not found', HttpStatus.NOT_FOUND, 'ROLE_NOT_FOUND');
    }
    return this.toDto(role);
  }

  /**
   * Resolve an active role by its role_code. Used by the users service to
   * dual-write role_id. Returns null when unknown or inactive so the caller
   * can decide the error shape.
   */
  async findActiveByRoleCode(roleCode: string): Promise<PortalRole | null> {
    return this.roleRepo.findOne({ where: { roleCode, isActive: true } });
  }

  // ==================== CREATE ====================

  /**
   * Create a role. `callerRole` enforces the same authority rule as user
   * creation (RVSK-USR-MGMT-001.1): RVSK_Admin may not mint a Super_Admin role.
   */
  async createRole(dto: CreateRoleDto, callerRole: string): Promise<RoleDto> {
    if (dto.roleCode === 'Super_Admin' && callerRole !== 'Super_Admin') {
      throw new AppException(
        'You are not permitted to create the Super_Admin role',
        HttpStatus.FORBIDDEN,
        'CREATE_ROLE_FORBIDDEN',
      );
    }

    const existing = await this.roleRepo.findOne({
      where: { roleCode: dto.roleCode },
    });
    if (existing) {
      throw new AppException(
        `Role code already exists: ${dto.roleCode}`,
        HttpStatus.CONFLICT,
        'ROLE_CODE_EXISTS',
      );
    }

    const now = new Date();
    const role = this.roleRepo.create({
      id: crypto.randomUUID(),
      roleCode: dto.roleCode,
      roleName: dto.roleName,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await this.roleRepo.save(role);
    this.logger.log(`Role created: ${saved.roleCode} by ${callerRole}`);
    return this.toDto(saved);
  }

  // ==================== UPDATE ====================

  /**
   * Update display metadata / activation. role_code is immutable (it is the
   * authorization key referenced by role_page_defaults_v2 and JWT claims), so
   * it is intentionally NOT updatable here.
   */
  async updateRole(id: string, dto: UpdateRoleDto): Promise<RoleDto> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new AppException('Role not found', HttpStatus.NOT_FOUND, 'ROLE_NOT_FOUND');
    }

    if (dto.roleName !== undefined) role.roleName = dto.roleName;
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.isActive !== undefined) role.isActive = dto.isActive;
    role.updatedAt = new Date();

    const saved = await this.roleRepo.save(role);
    this.logger.log(`Role updated: ${saved.roleCode}`);
    return this.toDto(saved);
  }

  /** Soft-deactivate a role (does not delete; preserves referential integrity). */
  async deactivateRole(id: string): Promise<RoleDto> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new AppException('Role not found', HttpStatus.NOT_FOUND, 'ROLE_NOT_FOUND');
    }
    role.isActive = false;
    role.updatedAt = new Date();
    const saved = await this.roleRepo.save(role);
    this.logger.log(`Role deactivated: ${saved.roleCode}`);
    return this.toDto(saved);
  }

  // ==================== MAPPING ====================

  private toDto(r: PortalRole): RoleDto {
    return {
      id: r.id,
      roleCode: r.roleCode,
      roleName: r.roleName,
      description: r.description ?? null,
      isActive: r.isActive,
      createdAt: r.createdAt ? r.createdAt.toISOString() : null,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    };
  }
}

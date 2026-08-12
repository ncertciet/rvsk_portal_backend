import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { RolePageDefaultV2 } from './entities/role-page-default-v2.entity';
import { UserPageOverrideV2 } from './entities/user-page-override-v2.entity';
import { PortalUser } from '../auth/entities/portal-user.entity';
import {
  EffectivePermission,
  PermissionSet,
  PermissionOverride,
  RolePageDefaultDto,
  UserOverrideDto,
} from './interfaces';

/**
 * PermissionServiceV2 — full RBAC V2 implementation.
 *
 * Resolves effective permissions by merging role defaults with user-specific overrides.
 * Algorithm:
 * 1. Load role page defaults WHERE role=? AND canView=true, with relations ['page', 'page.module']
 * 2. Build base permission map (pageId → EffectivePermission) filtering only active pages/modules
 * 3. If userId provided: load user overrides with relations ['page', 'page.module']
 * 4. Apply overrides:
 *    - canView=false → REMOVE page from map
 *    - canView=true on new page → ADD with canEdit/Export/Delete=false, then apply non-null fields
 *    - canView=null on existing → MERGE only non-null fields, inherit canView from default
 * 5. Filter final map: remove entries where page.isActive=false OR page.module.isActive=false
 * 6. Convert to access map: Record<string, string[]> (moduleCode → [pageCode, ...])
 */
@Injectable()
export class PermissionServiceV2 {
  constructor(
    @InjectRepository(RolePageDefaultV2)
    private readonly roleDefaultsRepo: Repository<RolePageDefaultV2>,
    @InjectRepository(UserPageOverrideV2)
    private readonly userOverridesRepo: Repository<UserPageOverrideV2>,
    @InjectRepository(PortalUser)
    private readonly usersRepo: Repository<PortalUser>,
  ) {}

  /**
   * Resolve full effective permissions for a user given role defaults + user overrides.
   * Returns Map<pageId, EffectivePermission>.
   *
   * Requirement 3.7: If user isActive=false, return empty map.
   * Requirement 3.8: If userId is null, resolve using role defaults only.
   */
  async getResolvedPermissions(
    userId: string | null,
    role: string,
  ): Promise<Map<string, EffectivePermission>> {
    // Req 3.7: If user is inactive, return empty map
    if (userId) {
      const user = await this.usersRepo.findOne({ where: { id: userId } });
      if (user && !user.isActive) {
        return new Map();
      }
    }

    // Step 1: Load role page defaults where canView=true
    const roleDefaults = await this.roleDefaultsRepo.find({
      where: { role, canView: true },
      relations: ['page', 'page.module'],
    });

    // Step 2: Build base permission map, filtering only active pages and active modules
    const permissionMap = new Map<string, EffectivePermission>();

    for (const rd of roleDefaults) {
      if (!rd.page || !rd.page.module) continue;
      if (!rd.page.isActive || !rd.page.module.isActive) continue;

      permissionMap.set(rd.pageId, {
        pageId: rd.pageId,
        pageCode: rd.page.pageCode,
        pageName: rd.page.pageName,
        routePath: rd.page.routePath,
        moduleCode: rd.page.module.moduleCode,
        moduleName: rd.page.module.moduleName,
        canView: rd.canView,
        canEdit: rd.canEdit,
        canExport: rd.canExport,
        canDelete: rd.canDelete,
      });
    }

    // Req 3.8: If userId is null, skip user overrides
    if (!userId) {
      return permissionMap;
    }

    // Step 3: Load user overrides with relations
    const userOverrides = await this.userOverridesRepo.find({
      where: { userId },
      relations: ['page', 'page.module'],
    });

    // Step 4: Apply overrides
    for (const override of userOverrides) {
      if (!override.page || !override.page.module) continue;

      const existingEntry = permissionMap.get(override.pageId);

      if (override.canView === false) {
        // Req 3.2: canView=false → REMOVE page from map
        permissionMap.delete(override.pageId);
      } else if (override.canView === true && !existingEntry) {
        // Req 3.3: canView=true on new page not in defaults → ADD with defaults false
        const newEntry: EffectivePermission = {
          pageId: override.pageId,
          pageCode: override.page.pageCode,
          pageName: override.page.pageName,
          routePath: override.page.routePath,
          moduleCode: override.page.module.moduleCode,
          moduleName: override.page.module.moduleName,
          canView: true,
          canEdit: false,
          canExport: false,
          canDelete: false,
        };

        // Apply non-null override fields on top
        if (override.canEdit !== null && override.canEdit !== undefined) {
          newEntry.canEdit = override.canEdit;
        }
        if (override.canExport !== null && override.canExport !== undefined) {
          newEntry.canExport = override.canExport;
        }
        if (override.canDelete !== null && override.canDelete !== undefined) {
          newEntry.canDelete = override.canDelete;
        }

        permissionMap.set(override.pageId, newEntry);
      } else if (existingEntry) {
        // Req 3.4 & 3.9: canView=null on existing → MERGE only non-null fields
        // Inherit canView from the role default (already set in existingEntry)
        if (override.canView !== null && override.canView !== undefined) {
          existingEntry.canView = override.canView;
        }
        if (override.canEdit !== null && override.canEdit !== undefined) {
          existingEntry.canEdit = override.canEdit;
        }
        if (override.canExport !== null && override.canExport !== undefined) {
          existingEntry.canExport = override.canExport;
        }
        if (override.canDelete !== null && override.canDelete !== undefined) {
          existingEntry.canDelete = override.canDelete;
        }

        permissionMap.set(override.pageId, existingEntry);
      }
    }

    // Step 5: Filter final map — remove entries where page.isActive=false OR module.isActive=false
    // We need to re-check because overrides may have added pages that are inactive
    for (const [pageId, entry] of permissionMap) {
      const override = userOverrides.find((o) => o.pageId === pageId);
      if (override && override.page) {
        if (!override.page.isActive || !override.page.module?.isActive) {
          permissionMap.delete(pageId);
        }
      }
    }

    return permissionMap;
  }

  /**
   * Resolve effective permissions and convert to access map format for JWT.
   * Returns Record<string, string[]> (moduleCode → [pageCode, ...]).
   */
  async getResolvedAccess(
    userId: string | null,
    role: string,
  ): Promise<Record<string, string[]>> {
    const permissionMap = await this.getResolvedPermissions(userId, role);
    return this.convertToAccessMap(permissionMap);
  }

  /**
   * Get a single page's effective permission for a user.
   */
  async getPagePermission(
    userId: string | null,
    role: string,
    pageId: string,
  ): Promise<EffectivePermission | null> {
    const permissionMap = await this.getResolvedPermissions(userId, role);
    return permissionMap.get(pageId) || null;
  }

  /**
   * Create or update a role page default entry.
   */
  async setRolePageDefault(
    role: string,
    pageId: string,
    permissions: PermissionSet,
  ): Promise<void> {
    const existing = await this.roleDefaultsRepo.findOne({
      where: { role, pageId },
    });

    if (existing) {
      existing.canView = permissions.canView;
      existing.canEdit = permissions.canEdit;
      existing.canExport = permissions.canExport;
      existing.canDelete = permissions.canDelete;
      await this.roleDefaultsRepo.save(existing);
    } else {
      const newDefault = this.roleDefaultsRepo.create({
        id: uuidv4(),
        role,
        pageId,
        canView: permissions.canView,
        canEdit: permissions.canEdit,
        canExport: permissions.canExport,
        canDelete: permissions.canDelete,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await this.roleDefaultsRepo.save(newDefault);
    }
  }

  /**
   * Remove a role page default entry.
   */
  async removeRolePageDefault(role: string, pageId: string): Promise<void> {
    await this.roleDefaultsRepo.delete({ role, pageId });
  }

  /**
   * Get all role defaults for a given role.
   */
  async getRoleDefaults(role: string): Promise<RolePageDefaultDto[]> {
    const defaults = await this.roleDefaultsRepo.find({
      where: { role },
      relations: ['page', 'page.module'],
    });

    return defaults
      .filter((d) => d.page && d.page.module)
      .map((d) => ({
        id: d.id,
        role: d.role,
        pageId: d.pageId,
        pageCode: d.page.pageCode,
        pageName: d.page.pageName,
        moduleId: d.page.module.id,
        moduleCode: d.page.module.moduleCode,
        permissions: {
          canView: d.canView,
          canEdit: d.canEdit,
          canExport: d.canExport,
          canDelete: d.canDelete,
        },
        createdAt: d.createdAt ? d.createdAt.toISOString() : null,
        updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
      }));
  }

  /**
   * Create or update a user-specific page override.
   */
  async setUserOverride(
    userId: string,
    pageId: string,
    override: PermissionOverride,
    updatedBy: string,
  ): Promise<void> {
    const existing = await this.userOverridesRepo.findOne({
      where: { userId, pageId },
    });

    if (existing) {
      if (override.canView !== undefined) {
        existing.canView = override.canView ?? null;
      }
      if (override.canEdit !== undefined) {
        existing.canEdit = override.canEdit ?? null;
      }
      if (override.canExport !== undefined) {
        existing.canExport = override.canExport ?? null;
      }
      if (override.canDelete !== undefined) {
        existing.canDelete = override.canDelete ?? null;
      }
      existing.updatedBy = updatedBy;
      await this.userOverridesRepo.save(existing);
    } else {
      const newOverride = this.userOverridesRepo.create({
        id: uuidv4(),
        userId,
        pageId,
        canView: override.canView ?? null,
        canEdit: override.canEdit ?? null,
        canExport: override.canExport ?? null,
        canDelete: override.canDelete ?? null,
        updatedBy,
      });
      await this.userOverridesRepo.save(newOverride);
    }
  }

  /**
   * Remove a specific user page override.
   */
  async removeUserOverride(userId: string, pageId: string): Promise<void> {
    await this.userOverridesRepo.delete({ userId, pageId });
  }

  /**
   * Delete all overrides for a user, resetting them to role defaults.
   */
  async resetUserToDefaults(userId: string): Promise<void> {
    await this.userOverridesRepo.delete({ userId });
  }

  /**
   * Get all user overrides for a user.
   */
  async getUserOverrides(userId: string): Promise<UserOverrideDto[]> {
    const overrides = await this.userOverridesRepo.find({
      where: { userId },
      relations: ['page', 'page.module'],
    });

    return overrides
      .filter((o) => o.page && o.page.module)
      .map((o) => ({
        id: o.id,
        userId: o.userId,
        pageId: o.pageId,
        pageCode: o.page.pageCode,
        pageName: o.page.pageName,
        moduleId: o.page.module.id,
        moduleCode: o.page.module.moduleCode,
        override: {
          canView: o.canView,
          canEdit: o.canEdit,
          canExport: o.canExport,
          canDelete: o.canDelete,
        },
        updatedBy: o.updatedBy,
        updatedAt: null,
      }));
  }

  /**
   * Convert a permission map to the access map format used in JWT claims.
   * Groups pages by moduleCode.
   */
  private convertToAccessMap(
    permissionMap: Map<string, EffectivePermission>,
  ): Record<string, string[]> {
    const accessMap: Record<string, string[]> = {};

    for (const [, entry] of permissionMap) {
      if (!entry.canView) continue;

      if (!accessMap[entry.moduleCode]) {
        accessMap[entry.moduleCode] = [];
      }
      accessMap[entry.moduleCode].push(entry.pageCode);
    }

    // Sort page codes within each module for deterministic output (Req 3.6)
    for (const moduleCode of Object.keys(accessMap)) {
      accessMap[moduleCode].sort();
    }

    return accessMap;
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
} from '@nestjs/common';
import { Roles, CurrentUser, AuthenticatedUser } from '@rvsk/common';
import { PermissionServiceV2 } from './permission.service';
import { MenuService } from './menu.service';
import {
  PermissionSet,
  PermissionOverride,
  RolePageDefaultDto,
  UserOverrideDto,
  EffectivePermission,
} from './interfaces';

@Controller('permissions')
export class PermissionController {
  constructor(
    private readonly permissionService: PermissionServiceV2,
    private readonly menuService: MenuService,
  ) {}

  /**
   * GET /api/v1/permissions/role-defaults/:role
   * Get all role page defaults for a given role.
   * Admin-only endpoint.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Get('role-defaults/:role')
  async getRoleDefaults(
    @Param('role') role: string,
  ): Promise<RolePageDefaultDto[]> {
    return this.permissionService.getRoleDefaults(role);
  }

  /**
   * PUT /api/v1/permissions/role-defaults
   * Create or update a role page default via body (frontend PermissionManagement format).
   * Body: { role, pageId, permissions: { canView, canEdit, canExport, canDelete } }
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Put('role-defaults')
  @HttpCode(200)
  async upsertRolePageDefault(
    @Body() body: { role: string; pageId: string; permissions: PermissionSet },
  ): Promise<{ success: boolean }> {
    await this.permissionService.setRolePageDefault(
      body.role,
      body.pageId,
      body.permissions,
    );
    return { success: true };
  }

  /**
   * POST /api/v1/permissions/role-defaults/:role/:pageId
   * Create or update a role page default entry.
   * Invalidates menu cache for affected users.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Post('role-defaults/:role/:pageId')
  @HttpCode(200)
  async setRolePageDefault(
    @Param('role') role: string,
    @Param('pageId') pageId: string,
    @Body() body: PermissionSet,
  ): Promise<{ success: boolean }> {
    await this.permissionService.setRolePageDefault(role, pageId, body);
    return { success: true };
  }

  /**
   * DELETE /api/v1/permissions/role-defaults/:role/:pageId
   * Remove a role page default entry.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Delete('role-defaults/:role/:pageId')
  async removeRolePageDefault(
    @Param('role') role: string,
    @Param('pageId') pageId: string,
  ): Promise<{ success: boolean }> {
    await this.permissionService.removeRolePageDefault(role, pageId);
    return { success: true };
  }

  /**
   * GET /api/v1/permissions/roles/:role/defaults
   * Alternative route used by UserPermissions.tsx to get role defaults.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Get('roles/:role/defaults')
  async getRoleDefaultsAlternate(
    @Param('role') role: string,
  ): Promise<{ data: Record<string, RolePageDefaultDto[]> }> {
    const defaults = await this.permissionService.getRoleDefaults(role);
    // Group by moduleCode for the frontend's expected format
    const grouped: Record<string, RolePageDefaultDto[]> = {};
    for (const d of defaults) {
      if (!grouped[d.moduleCode]) grouped[d.moduleCode] = [];
      grouped[d.moduleCode].push(d);
    }
    return { data: grouped };
  }

  /**
   * GET /api/v1/permissions/user-overrides/:userId
   * Get all user-specific permission overrides.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Get('user-overrides/:userId')
  async getUserOverrides(
    @Param('userId') userId: string,
  ): Promise<UserOverrideDto[]> {
    return this.permissionService.getUserOverrides(userId);
  }

  /**
   * PUT /api/v1/permissions/user-overrides
   * Create or update a user-specific page override via body (frontend PermissionManagement format).
   * Body: { userId, pageId, override: { canView, canEdit, canExport, canDelete } }
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Put('user-overrides')
  @HttpCode(200)
  async upsertUserOverride(
    @Body() body: { userId: string; pageId: string; override: PermissionOverride },
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.permissionService.setUserOverride(
      body.userId,
      body.pageId,
      body.override,
      admin.userId,
    );
    return { success: true };
  }

  /**
   * POST /api/v1/permissions/user-overrides/:userId/:pageId
   * Create or update a user-specific page override.
   * Invalidates menu cache for the affected user.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Post('user-overrides/:userId/:pageId')
  @HttpCode(200)
  async setUserOverride(
    @Param('userId') userId: string,
    @Param('pageId') pageId: string,
    @Body() body: PermissionOverride,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<{ success: boolean }> {
    await this.permissionService.setUserOverride(
      userId,
      pageId,
      body,
      admin.userId,
    );
    return { success: true };
  }

  /**
   * DELETE /api/v1/permissions/user-overrides/:userId/:pageId
   * Remove a specific user page override.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Delete('user-overrides/:userId/:pageId')
  async removeUserOverride(
    @Param('userId') userId: string,
    @Param('pageId') pageId: string,
  ): Promise<{ success: boolean }> {
    await this.permissionService.removeUserOverride(userId, pageId);
    return { success: true };
  }

  /**
   * DELETE /api/v1/permissions/user-overrides/:userId
   * Reset all user overrides, reverting to role defaults.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Delete('user-overrides/:userId')
  async resetUserToDefaults(
    @Param('userId') userId: string,
  ): Promise<{ success: boolean }> {
    await this.permissionService.resetUserToDefaults(userId);
    return { success: true };
  }

  /**
   * GET /api/v1/permissions/users/:userId/resolved
   * Get the resolved permissions for a specific user (frontend UserPermissions.tsx format).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Get('users/:userId/resolved')
  async getUserResolvedPermissions(
    @Param('userId') userId: string,
    @Query('role') role?: string,
  ): Promise<{ access: Record<string, string[]> }> {
    const effectiveRole = role || 'Read_Only_User';
    const permissionMap = await this.permissionService.getResolvedPermissions(
      userId,
      effectiveRole,
    );
    // Convert to access map format: { moduleCode: [pageCode, ...] }
    const access: Record<string, string[]> = {};
    for (const perm of permissionMap.values()) {
      if (perm.canView) {
        if (!access[perm.moduleCode]) access[perm.moduleCode] = [];
        access[perm.moduleCode].push(perm.pageCode);
      }
    }
    return { access };
  }

  /**
   * PUT /api/v1/permissions/users/:userId/overrides
   * Batch update user overrides (frontend UserPermissions.tsx format).
   * Body: Array of { module, pageId, canView, canExport }
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Put('users/:userId/overrides')
  @HttpCode(200)
  async batchUpdateUserOverrides(
    @Param('userId') userId: string,
    @Body() overrides: { module: string; pageId: string; canView: boolean; canExport: boolean }[],
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<{ success: boolean; count: number }> {
    for (const o of overrides) {
      await this.permissionService.setUserOverride(
        userId,
        o.pageId,
        {
          canView: o.canView,
          canEdit: null,
          canExport: o.canExport,
          canDelete: null,
        },
        admin.userId,
      );
    }
    return { success: true, count: overrides.length };
  }

  /**
   * DELETE /api/v1/permissions/users/:userId/overrides
   * Reset all user overrides (frontend UserPermissions.tsx format).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Delete('users/:userId/overrides')
  async resetUserOverridesAlternate(
    @Param('userId') userId: string,
  ): Promise<{ success: boolean }> {
    await this.permissionService.resetUserToDefaults(userId);
    return { success: true };
  }

  /**
   * GET /api/v1/permissions/my-access
   * Get the current user's resolved effective permissions.
   */
  @Get('my-access')
  async getMyAccess(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EffectivePermission[]> {
    const permissionMap = await this.permissionService.getResolvedPermissions(
      user.userId,
      user.role,
    );
    return Array.from(permissionMap.values());
  }
}

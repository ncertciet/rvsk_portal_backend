import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService } from '@rvsk/common';

import { ModuleMaster } from './entities/module-master.entity';
import { PageMaster } from './entities/page-master.entity';
import { PermissionServiceV2 } from './permission.service';
import { MenuNode, MenuPageNode } from './interfaces';

// Re-export interfaces for consumers that import from menu.service
export { MenuNode, MenuPageNode } from './interfaces';

/**
 * MenuService — builds the dynamic navigation menu tree filtered by effective permissions.
 *
 * Requirement 4.1: Include only pages where canView=true, page isActive=true, module isActive=true.
 *                  Exclude modules with zero visible pages after filtering.
 * Requirement 4.2: Sort modules and pages by displayOrder ascending.
 * Requirement 4.3: Return cached tree when available without querying database.
 * Requirement 4.4: Cache with TTL 300s on cache miss.
 * Requirement 4.5: Invalidate on permission changes.
 * Requirement 4.6: Don't cache partial/empty tree on DB failure.
 */
@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);
  private static readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @InjectRepository(ModuleMaster)
    private readonly moduleRepo: Repository<ModuleMaster>,
    @InjectRepository(PageMaster)
    private readonly pageRepo: Repository<PageMaster>,
    private readonly permissionService: PermissionServiceV2,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get the menu tree for a user, using cache if available.
   */
  async getMenuTree(userId: string, role: string): Promise<MenuNode[]> {
    const cacheKey = `menu:${userId}:${role}`;

    // Req 4.3: Check cache first
    const cached = await this.cacheService.get<MenuNode[]>(cacheKey);
    if (cached) {
      this.logger.debug(`Menu cache hit for key: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Menu cache miss for key: ${cacheKey}, building tree from database`);

    // Req 4.6: Build tree from database; don't cache on failure (exception propagates)
    const tree = await this.buildMenuTree(userId, role);

    // Req 4.4: Cache with TTL 300s
    await this.cacheService.set(cacheKey, tree, MenuService.CACHE_TTL);

    return tree;
  }

  /**
   * Invalidate the cached menu tree for a user/role combination.
   * Called when role-page defaults or user-page overrides are changed (Req 4.5).
   */
  async invalidateMenuCache(userId: string, role: string): Promise<void> {
    const cacheKey = `menu:${userId}:${role}`;
    await this.cacheService.del(cacheKey);
    this.logger.debug(`Menu cache invalidated for key: ${cacheKey}`);
  }

  /**
   * Invalidate all menu cache entries for a given user (across all roles).
   * Useful when user overrides change but the user's role is unknown.
   */
  async invalidateAllMenuCacheForUser(userId: string): Promise<void> {
    await this.cacheService.delPattern(`menu:${userId}:*`);
    this.logger.debug(`All menu cache entries invalidated for user: ${userId}`);
  }

  /**
   * Build the menu tree from the database using effective permissions.
   */
  private async buildMenuTree(userId: string, role: string): Promise<MenuNode[]> {
    // Get effective permissions for the user
    const permissionMap = await this.permissionService.getResolvedPermissions(userId, role);

    if (permissionMap.size === 0) {
      return [];
    }

    // Load all active modules for icon and displayOrder details
    const activeModules = await this.moduleRepo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });

    // Load all active pages for icon and displayOrder details
    const activePages = await this.pageRepo.find({
      where: { isActive: true },
      relations: ['module'],
      order: { displayOrder: 'ASC' },
    });

    // Create lookup maps
    const moduleDetailsMap = new Map<string, ModuleMaster>();
    for (const mod of activeModules) {
      moduleDetailsMap.set(mod.moduleCode, mod);
    }

    const pageDetailsMap = new Map<string, PageMaster>();
    for (const page of activePages) {
      pageDetailsMap.set(page.pageCode, page);
    }

    // Group pages by module using effective permissions
    const moduleMap = new Map<string, MenuNode>();

    for (const [, perm] of permissionMap) {
      if (!perm.canView) continue;

      // Validate module is active
      const moduleDetails = moduleDetailsMap.get(perm.moduleCode);
      if (!moduleDetails || !moduleDetails.isActive) continue;

      // Validate page is active
      const pageDetails = pageDetailsMap.get(perm.pageCode);
      if (!pageDetails || !pageDetails.isActive) continue;

      if (!moduleMap.has(perm.moduleCode)) {
        moduleMap.set(perm.moduleCode, {
          moduleCode: perm.moduleCode,
          moduleName: perm.moduleName,
          name: perm.moduleName,
          icon: moduleDetails.icon || '',
          displayOrder: moduleDetails.displayOrder,
          pages: [],
        });
      }

      const pageNode: MenuPageNode = {
        pageCode: perm.pageCode,
        pageName: perm.pageName,
        name: perm.pageName,
        routePath: perm.routePath,
        icon: pageDetails.icon || '',
        displayOrder: pageDetails.displayOrder,
        canView: perm.canView,
        canEdit: perm.canEdit,
        canExport: perm.canExport,
        canDelete: perm.canDelete,
      };

      moduleMap.get(perm.moduleCode)!.pages.push(pageNode);
    }

    // Req 4.1: Exclude modules with zero visible pages
    // Req 4.2: Sort modules by displayOrder, pages within each module by displayOrder
    const tree: MenuNode[] = Array.from(moduleMap.values())
      .filter((mod) => mod.pages.length > 0)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((mod) => ({
        ...mod,
        pages: [...mod.pages].sort((a, b) => a.displayOrder - b.displayOrder),
      }));

    return tree;
  }
}

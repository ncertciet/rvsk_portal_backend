import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuService } from './menu.service';
import { PermissionServiceV2 } from './permission.service';
import { ModuleMaster } from './entities/module-master.entity';
import { PageMaster } from './entities/page-master.entity';
import { CacheService } from '@rvsk/common';
import { EffectivePermission, MenuNode } from './interfaces';

// Helper to build a ModuleMaster entity
function buildModule(overrides: Partial<ModuleMaster> = {}): ModuleMaster {
  return {
    id: 'mod-1',
    moduleCode: 'MODULE_A',
    moduleName: 'Module A',
    icon: 'icon-a',
    displayOrder: 1,
    isActive: true,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ModuleMaster;
}

// Helper to build a PageMaster entity
function buildPage(overrides: Partial<PageMaster> = {}): PageMaster {
  return {
    id: 'page-1',
    moduleId: 'mod-1',
    module: buildModule(),
    pageCode: 'PAGE_1',
    pageName: 'Page 1',
    routePath: '/module-a/page-1',
    icon: 'page-icon-1',
    displayOrder: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PageMaster;
}

// Helper to build an EffectivePermission
function buildPermission(overrides: Partial<EffectivePermission> = {}): EffectivePermission {
  return {
    pageId: 'page-1',
    pageCode: 'PAGE_1',
    pageName: 'Page 1',
    routePath: '/module-a/page-1',
    moduleCode: 'MODULE_A',
    moduleName: 'Module A',
    canView: true,
    canEdit: false,
    canExport: false,
    canDelete: false,
    ...overrides,
  };
}

describe('MenuService', () => {
  let service: MenuService;
  let permissionService: jest.Mocked<PermissionServiceV2>;
  let cacheService: jest.Mocked<CacheService>;
  let moduleRepo: jest.Mocked<Repository<ModuleMaster>>;
  let pageRepo: jest.Mocked<Repository<PageMaster>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        {
          provide: PermissionServiceV2,
          useValue: {
            getResolvedPermissions: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            delPattern: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ModuleMaster),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PageMaster),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MenuService>(MenuService);
    permissionService = module.get(PermissionServiceV2);
    cacheService = module.get(CacheService);
    moduleRepo = module.get(getRepositoryToken(ModuleMaster));
    pageRepo = module.get(getRepositoryToken(PageMaster));
  });

  describe('getMenuTree', () => {
    it('should return cached tree on cache hit without querying database (Req 4.3)', async () => {
      const cachedTree: MenuNode[] = [
        {
          moduleCode: 'MODULE_A',
          moduleName: 'Module A',
          icon: 'icon-a',
          displayOrder: 1,
          pages: [
            {
              pageCode: 'PAGE_1',
              pageName: 'Page 1',
              routePath: '/module-a/page-1',
              icon: 'page-icon',
              displayOrder: 1,
              canView: true,
              canEdit: false,
              canExport: false,
              canDelete: false,
            },
          ],
        },
      ];
      cacheService.get.mockResolvedValue(cachedTree);

      const result = await service.getMenuTree('user-1', 'Super_Admin');

      expect(result).toEqual(cachedTree);
      expect(cacheService.get).toHaveBeenCalledWith('menu:user-1:Super_Admin');
      expect(permissionService.getResolvedPermissions).not.toHaveBeenCalled();
      expect(moduleRepo.find).not.toHaveBeenCalled();
      expect(pageRepo.find).not.toHaveBeenCalled();
    });

    it('should build tree from database on cache miss and cache result with TTL 300s (Req 4.4)', async () => {
      cacheService.get.mockResolvedValue(null);

      const permissions = new Map<string, EffectivePermission>();
      permissions.set('page-1', buildPermission());

      permissionService.getResolvedPermissions.mockResolvedValue(permissions);
      moduleRepo.find.mockResolvedValue([buildModule()]);
      pageRepo.find.mockResolvedValue([buildPage()]);

      const result = await service.getMenuTree('user-1', 'Super_Admin');

      expect(result).toHaveLength(1);
      expect(result[0].moduleCode).toBe('MODULE_A');
      expect(result[0].pages).toHaveLength(1);
      expect(result[0].pages[0].pageCode).toBe('PAGE_1');

      // Verify it was cached with TTL 300
      expect(cacheService.set).toHaveBeenCalledWith(
        'menu:user-1:Super_Admin',
        result,
        300,
      );
    });

    it('should include only pages where canView=true (Req 4.1)', async () => {
      cacheService.get.mockResolvedValue(null);

      const permissions = new Map<string, EffectivePermission>();
      permissions.set('page-1', buildPermission({ canView: true }));
      permissions.set('page-2', buildPermission({
        pageId: 'page-2',
        pageCode: 'PAGE_2',
        pageName: 'Page 2',
        routePath: '/module-a/page-2',
        canView: false,
      }));

      permissionService.getResolvedPermissions.mockResolvedValue(permissions);
      moduleRepo.find.mockResolvedValue([buildModule()]);
      pageRepo.find.mockResolvedValue([
        buildPage(),
        buildPage({ id: 'page-2', pageCode: 'PAGE_2', routePath: '/module-a/page-2' }),
      ]);

      const result = await service.getMenuTree('user-1', 'Super_Admin');

      expect(result).toHaveLength(1);
      expect(result[0].pages).toHaveLength(1);
      expect(result[0].pages[0].pageCode).toBe('PAGE_1');
    });

    it('should exclude modules with zero visible pages (Req 4.1)', async () => {
      cacheService.get.mockResolvedValue(null);

      // All permissions have canView=false — no pages visible
      const permissions = new Map<string, EffectivePermission>();
      permissions.set('page-1', buildPermission({ canView: false }));

      permissionService.getResolvedPermissions.mockResolvedValue(permissions);
      moduleRepo.find.mockResolvedValue([buildModule()]);
      pageRepo.find.mockResolvedValue([buildPage()]);

      const result = await service.getMenuTree('user-1', 'RVSK_SPOC');

      expect(result).toHaveLength(0);
    });

    it('should sort modules by displayOrder ascending (Req 4.2)', async () => {
      cacheService.get.mockResolvedValue(null);

      const modA = buildModule({ moduleCode: 'MODULE_A', moduleName: 'Module A', displayOrder: 3 });
      const modB = buildModule({ id: 'mod-2', moduleCode: 'MODULE_B', moduleName: 'Module B', displayOrder: 1 });

      const permissions = new Map<string, EffectivePermission>();
      permissions.set('page-1', buildPermission({ moduleCode: 'MODULE_A', moduleName: 'Module A' }));
      permissions.set('page-2', buildPermission({
        pageId: 'page-2',
        pageCode: 'PAGE_2',
        pageName: 'Page 2',
        routePath: '/module-b/page-2',
        moduleCode: 'MODULE_B',
        moduleName: 'Module B',
      }));

      permissionService.getResolvedPermissions.mockResolvedValue(permissions);
      moduleRepo.find.mockResolvedValue([modB, modA]);
      pageRepo.find.mockResolvedValue([
        buildPage(),
        buildPage({ id: 'page-2', pageCode: 'PAGE_2', routePath: '/module-b/page-2', moduleId: 'mod-2' }),
      ]);

      const result = await service.getMenuTree('user-1', 'Super_Admin');

      expect(result).toHaveLength(2);
      // Module B has displayOrder=1, should come first
      expect(result[0].moduleCode).toBe('MODULE_B');
      expect(result[0].displayOrder).toBe(1);
      expect(result[1].moduleCode).toBe('MODULE_A');
      expect(result[1].displayOrder).toBe(3);
    });

    it('should sort pages within a module by displayOrder ascending (Req 4.2)', async () => {
      cacheService.get.mockResolvedValue(null);

      const permissions = new Map<string, EffectivePermission>();
      permissions.set('page-1', buildPermission({ pageCode: 'PAGE_1', pageName: 'Page 1' }));
      permissions.set('page-2', buildPermission({
        pageId: 'page-2',
        pageCode: 'PAGE_2',
        pageName: 'Page 2',
        routePath: '/module-a/page-2',
      }));

      permissionService.getResolvedPermissions.mockResolvedValue(permissions);
      moduleRepo.find.mockResolvedValue([buildModule()]);
      pageRepo.find.mockResolvedValue([
        buildPage({ displayOrder: 5 }),
        buildPage({ id: 'page-2', pageCode: 'PAGE_2', routePath: '/module-a/page-2', displayOrder: 2 }),
      ]);

      const result = await service.getMenuTree('user-1', 'Super_Admin');

      expect(result[0].pages).toHaveLength(2);
      // PAGE_2 has displayOrder=2, should come first
      expect(result[0].pages[0].pageCode).toBe('PAGE_2');
      expect(result[0].pages[0].displayOrder).toBe(2);
      expect(result[0].pages[1].pageCode).toBe('PAGE_1');
      expect(result[0].pages[1].displayOrder).toBe(5);
    });

    it('should populate module and page icons from database entities', async () => {
      cacheService.get.mockResolvedValue(null);

      const permissions = new Map<string, EffectivePermission>();
      permissions.set('page-1', buildPermission());

      permissionService.getResolvedPermissions.mockResolvedValue(permissions);
      moduleRepo.find.mockResolvedValue([buildModule({ icon: 'dashboard-icon' })]);
      pageRepo.find.mockResolvedValue([buildPage({ icon: 'file-icon' })]);

      const result = await service.getMenuTree('user-1', 'Super_Admin');

      expect(result[0].icon).toBe('dashboard-icon');
      expect(result[0].pages[0].icon).toBe('file-icon');
    });

    it('should use empty string for null icons', async () => {
      cacheService.get.mockResolvedValue(null);

      const permissions = new Map<string, EffectivePermission>();
      permissions.set('page-1', buildPermission());

      permissionService.getResolvedPermissions.mockResolvedValue(permissions);
      moduleRepo.find.mockResolvedValue([buildModule({ icon: null as any })]);
      pageRepo.find.mockResolvedValue([buildPage({ icon: null as any })]);

      const result = await service.getMenuTree('user-1', 'Super_Admin');

      expect(result[0].icon).toBe('');
      expect(result[0].pages[0].icon).toBe('');
    });

    it('should return empty array when user has no permissions', async () => {
      cacheService.get.mockResolvedValue(null);

      permissionService.getResolvedPermissions.mockResolvedValue(new Map());
      moduleRepo.find.mockResolvedValue([buildModule()]);
      pageRepo.find.mockResolvedValue([buildPage()]);

      const result = await service.getMenuTree('user-1', 'State_Admin');

      expect(result).toEqual([]);
      // Should still cache empty result
      expect(cacheService.set).toHaveBeenCalledWith('menu:user-1:State_Admin', [], 300);
    });

    it('should exclude pages where module is not in active modules list', async () => {
      cacheService.get.mockResolvedValue(null);

      const permissions = new Map<string, EffectivePermission>();
      permissions.set('page-1', buildPermission({ moduleCode: 'INACTIVE_MOD', moduleName: 'Inactive' }));

      permissionService.getResolvedPermissions.mockResolvedValue(permissions);
      // Only MODULE_A is active, INACTIVE_MOD is not present
      moduleRepo.find.mockResolvedValue([buildModule()]);
      pageRepo.find.mockResolvedValue([buildPage()]);

      const result = await service.getMenuTree('user-1', 'Super_Admin');

      expect(result).toHaveLength(0);
    });

    it('should propagate database errors without caching (Req 4.6)', async () => {
      cacheService.get.mockResolvedValue(null);
      permissionService.getResolvedPermissions.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(service.getMenuTree('user-1', 'Super_Admin')).rejects.toThrow(
        'Database connection failed',
      );

      // Should NOT cache anything on error
      expect(cacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('invalidateMenuCache', () => {
    it('should delete cache for specific user+role key (Req 4.5)', async () => {
      await service.invalidateMenuCache('user-1', 'Super_Admin');

      expect(cacheService.del).toHaveBeenCalledWith('menu:user-1:Super_Admin');
    });
  });

  describe('invalidateAllMenuCacheForUser', () => {
    it('should delete all cache entries matching user pattern', async () => {
      await service.invalidateAllMenuCacheForUser('user-1');

      expect(cacheService.delPattern).toHaveBeenCalledWith('menu:user-1:*');
    });
  });
});

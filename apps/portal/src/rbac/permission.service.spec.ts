import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionServiceV2 } from './permission.service';
import { RolePageDefaultV2 } from './entities/role-page-default-v2.entity';
import { UserPageOverrideV2 } from './entities/user-page-override-v2.entity';
import { PortalUser } from '../auth/entities/portal-user.entity';

// Helpers to build test data
function buildModule(overrides: Partial<any> = {}) {
  return {
    id: 'mod-1',
    moduleCode: 'MODULE_A',
    moduleName: 'Module A',
    icon: 'icon-a',
    displayOrder: 1,
    isActive: true,
    ...overrides,
  };
}

function buildPage(overrides: Partial<any> = {}) {
  return {
    id: 'page-1',
    moduleId: 'mod-1',
    pageCode: 'PAGE_1',
    pageName: 'Page 1',
    routePath: '/module-a/page-1',
    icon: 'page-icon',
    displayOrder: 1,
    isActive: true,
    module: buildModule(),
    ...overrides,
  };
}

function buildRoleDefault(overrides: Partial<any> = {}) {
  return {
    id: 'rd-1',
    role: 'Super_Admin',
    pageId: 'page-1',
    page: buildPage(),
    canView: true,
    canEdit: true,
    canExport: false,
    canDelete: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as RolePageDefaultV2;
}

function buildUserOverride(overrides: Partial<any> = {}) {
  return {
    id: 'uo-1',
    userId: 'user-1',
    pageId: 'page-1',
    page: buildPage(),
    canView: null,
    canEdit: null,
    canExport: null,
    canDelete: null,
    updatedBy: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as UserPageOverrideV2;
}

describe('PermissionServiceV2', () => {
  let service: PermissionServiceV2;
  let roleDefaultsRepo: jest.Mocked<Repository<RolePageDefaultV2>>;
  let userOverridesRepo: jest.Mocked<Repository<UserPageOverrideV2>>;
  let usersRepo: jest.Mocked<Repository<PortalUser>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionServiceV2,
        {
          provide: getRepositoryToken(RolePageDefaultV2),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn((entity) => entity),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserPageOverrideV2),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn((entity) => entity),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PortalUser),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PermissionServiceV2>(PermissionServiceV2);
    roleDefaultsRepo = module.get(getRepositoryToken(RolePageDefaultV2));
    userOverridesRepo = module.get(getRepositoryToken(UserPageOverrideV2));
    usersRepo = module.get(getRepositoryToken(PortalUser));
  });

  describe('getResolvedPermissions', () => {
    it('should return base permissions from role defaults for active pages/modules', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', isActive: true } as any);
      roleDefaultsRepo.find.mockResolvedValue([
        buildRoleDefault(),
      ]);
      userOverridesRepo.find.mockResolvedValue([]);

      const result = await service.getResolvedPermissions('user-1', 'Super_Admin');

      expect(result.size).toBe(1);
      const perm = result.get('page-1');
      expect(perm).toBeDefined();
      expect(perm!.pageCode).toBe('PAGE_1');
      expect(perm!.canView).toBe(true);
      expect(perm!.canEdit).toBe(true);
      expect(perm!.canExport).toBe(false);
      expect(perm!.moduleCode).toBe('MODULE_A');
    });

    it('should return empty map if user isActive=false (Req 3.7)', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', isActive: false } as any);

      const result = await service.getResolvedPermissions('user-1', 'Super_Admin');

      expect(result.size).toBe(0);
      expect(roleDefaultsRepo.find).not.toHaveBeenCalled();
    });

    it('should skip user overrides if userId is null (Req 3.8)', async () => {
      roleDefaultsRepo.find.mockResolvedValue([buildRoleDefault()]);

      const result = await service.getResolvedPermissions(null, 'Super_Admin');

      expect(result.size).toBe(1);
      expect(userOverridesRepo.find).not.toHaveBeenCalled();
    });

    it('should exclude pages where page.isActive=false (Req 3.5)', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', isActive: true } as any);
      roleDefaultsRepo.find.mockResolvedValue([
        buildRoleDefault({ page: buildPage({ isActive: false }) }),
      ]);
      userOverridesRepo.find.mockResolvedValue([]);

      const result = await service.getResolvedPermissions('user-1', 'Super_Admin');

      expect(result.size).toBe(0);
    });

    it('should exclude pages where module.isActive=false (Req 3.5)', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', isActive: true } as any);
      roleDefaultsRepo.find.mockResolvedValue([
        buildRoleDefault({
          page: buildPage({ module: buildModule({ isActive: false }) }),
        }),
      ]);
      userOverridesRepo.find.mockResolvedValue([]);

      const result = await service.getResolvedPermissions('user-1', 'Super_Admin');

      expect(result.size).toBe(0);
    });

    it('should remove page from map when override sets canView=false (Req 3.2)', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', isActive: true } as any);
      roleDefaultsRepo.find.mockResolvedValue([buildRoleDefault()]);
      userOverridesRepo.find.mockResolvedValue([
        buildUserOverride({ canView: false }),
      ]);

      const result = await service.getResolvedPermissions('user-1', 'Super_Admin');

      expect(result.size).toBe(0);
    });

    it('should add page when override sets canView=true on page not in defaults (Req 3.3)', async () => {
      const newPage = buildPage({
        id: 'page-2',
        pageCode: 'PAGE_2',
        pageName: 'Page 2',
        routePath: '/module-a/page-2',
      });
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', isActive: true } as any);
      roleDefaultsRepo.find.mockResolvedValue([]);
      userOverridesRepo.find.mockResolvedValue([
        buildUserOverride({
          pageId: 'page-2',
          page: newPage,
          canView: true,
          canEdit: true,
          canExport: null,
          canDelete: null,
        }),
      ]);

      const result = await service.getResolvedPermissions('user-1', 'Super_Admin');

      expect(result.size).toBe(1);
      const perm = result.get('page-2');
      expect(perm).toBeDefined();
      expect(perm!.canView).toBe(true);
      expect(perm!.canEdit).toBe(true);
      expect(perm!.canExport).toBe(false); // default false
      expect(perm!.canDelete).toBe(false); // default false
    });

    it('should merge only non-null fields when canView is null on existing page (Req 3.4, 3.9)', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', isActive: true } as any);
      roleDefaultsRepo.find.mockResolvedValue([
        buildRoleDefault({ canView: true, canEdit: false, canExport: true, canDelete: false }),
      ]);
      userOverridesRepo.find.mockResolvedValue([
        buildUserOverride({
          canView: null,
          canEdit: true,
          canExport: null,
          canDelete: true,
        }),
      ]);

      const result = await service.getResolvedPermissions('user-1', 'Super_Admin');

      expect(result.size).toBe(1);
      const perm = result.get('page-1');
      expect(perm!.canView).toBe(true);    // inherited from default
      expect(perm!.canEdit).toBe(true);    // overridden
      expect(perm!.canExport).toBe(true);  // inherited from default (null override)
      expect(perm!.canDelete).toBe(true);  // overridden
    });

    it('should filter overridden pages where page or module inactive after merge (Req 3.5)', async () => {
      const inactivePage = buildPage({
        id: 'page-3',
        pageCode: 'PAGE_3',
        isActive: false,
      });
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', isActive: true } as any);
      roleDefaultsRepo.find.mockResolvedValue([]);
      userOverridesRepo.find.mockResolvedValue([
        buildUserOverride({
          pageId: 'page-3',
          page: inactivePage,
          canView: true,
        }),
      ]);

      const result = await service.getResolvedPermissions('user-1', 'Super_Admin');

      expect(result.size).toBe(0);
    });
  });

  describe('getResolvedAccess', () => {
    it('should convert permission map to moduleCode → pageCode[] format', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', isActive: true } as any);
      roleDefaultsRepo.find.mockResolvedValue([
        buildRoleDefault(),
        buildRoleDefault({
          id: 'rd-2',
          pageId: 'page-2',
          page: buildPage({ id: 'page-2', pageCode: 'PAGE_2', routePath: '/module-a/page-2' }),
        }),
      ]);
      userOverridesRepo.find.mockResolvedValue([]);

      const result = await service.getResolvedAccess('user-1', 'Super_Admin');

      expect(result).toEqual({
        MODULE_A: ['PAGE_1', 'PAGE_2'],
      });
    });

    it('should sort page codes within each module for deterministic output (Req 3.6)', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', isActive: true } as any);
      roleDefaultsRepo.find.mockResolvedValue([
        buildRoleDefault({
          id: 'rd-z',
          pageId: 'page-z',
          page: buildPage({ id: 'page-z', pageCode: 'ZEBRA', routePath: '/a/z' }),
        }),
        buildRoleDefault({
          id: 'rd-a',
          pageId: 'page-a',
          page: buildPage({ id: 'page-a', pageCode: 'ALPHA', routePath: '/a/a' }),
        }),
      ]);
      userOverridesRepo.find.mockResolvedValue([]);

      const result = await service.getResolvedAccess('user-1', 'Super_Admin');

      expect(result['MODULE_A']).toEqual(['ALPHA', 'ZEBRA']);
    });
  });

  describe('getPagePermission', () => {
    it('should return the specific page permission', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', isActive: true } as any);
      roleDefaultsRepo.find.mockResolvedValue([buildRoleDefault()]);
      userOverridesRepo.find.mockResolvedValue([]);

      const result = await service.getPagePermission('user-1', 'Super_Admin', 'page-1');

      expect(result).toBeDefined();
      expect(result!.pageId).toBe('page-1');
    });

    it('should return null for page not in permissions', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', isActive: true } as any);
      roleDefaultsRepo.find.mockResolvedValue([buildRoleDefault()]);
      userOverridesRepo.find.mockResolvedValue([]);

      const result = await service.getPagePermission('user-1', 'Super_Admin', 'page-nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('setRolePageDefault', () => {
    it('should update existing role default', async () => {
      const existing = buildRoleDefault();
      roleDefaultsRepo.findOne.mockResolvedValue(existing as any);
      roleDefaultsRepo.save.mockResolvedValue(existing as any);

      await service.setRolePageDefault('Super_Admin', 'page-1', {
        canView: true,
        canEdit: true,
        canExport: true,
        canDelete: true,
      });

      expect(roleDefaultsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          canEdit: true,
          canExport: true,
          canDelete: true,
        }),
      );
    });

    it('should create new role default if not exists', async () => {
      roleDefaultsRepo.findOne.mockResolvedValue(null);
      roleDefaultsRepo.save.mockResolvedValue({} as any);

      await service.setRolePageDefault('Super_Admin', 'page-1', {
        canView: true,
        canEdit: false,
        canExport: false,
        canDelete: false,
      });

      expect(roleDefaultsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'Super_Admin',
          pageId: 'page-1',
          canView: true,
        }),
      );
      expect(roleDefaultsRepo.save).toHaveBeenCalled();
    });
  });

  describe('removeRolePageDefault', () => {
    it('should delete the role page default', async () => {
      roleDefaultsRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.removeRolePageDefault('Super_Admin', 'page-1');

      expect(roleDefaultsRepo.delete).toHaveBeenCalledWith({
        role: 'Super_Admin',
        pageId: 'page-1',
      });
    });
  });

  describe('getRoleDefaults', () => {
    it('should return mapped role defaults', async () => {
      roleDefaultsRepo.find.mockResolvedValue([buildRoleDefault()]);

      const result = await service.getRoleDefaults('Super_Admin');

      expect(result).toHaveLength(1);
      expect(result[0].pageCode).toBe('PAGE_1');
      expect(result[0].moduleCode).toBe('MODULE_A');
    });
  });

  describe('setUserOverride', () => {
    it('should update existing override', async () => {
      const existing = buildUserOverride();
      userOverridesRepo.findOne.mockResolvedValue(existing as any);
      userOverridesRepo.save.mockResolvedValue(existing as any);

      await service.setUserOverride('user-1', 'page-1', { canEdit: true }, 'admin-1');

      expect(userOverridesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ canEdit: true, updatedBy: 'admin-1' }),
      );
    });

    it('should create new override if not exists', async () => {
      userOverridesRepo.findOne.mockResolvedValue(null);
      userOverridesRepo.save.mockResolvedValue({} as any);

      await service.setUserOverride('user-1', 'page-1', { canView: false }, 'admin-1');

      expect(userOverridesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          pageId: 'page-1',
          canView: false,
          updatedBy: 'admin-1',
        }),
      );
      expect(userOverridesRepo.save).toHaveBeenCalled();
    });
  });

  describe('removeUserOverride', () => {
    it('should delete user override', async () => {
      userOverridesRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.removeUserOverride('user-1', 'page-1');

      expect(userOverridesRepo.delete).toHaveBeenCalledWith({
        userId: 'user-1',
        pageId: 'page-1',
      });
    });
  });

  describe('resetUserToDefaults', () => {
    it('should delete all overrides for user', async () => {
      userOverridesRepo.delete.mockResolvedValue({ affected: 3, raw: [] });

      await service.resetUserToDefaults('user-1');

      expect(userOverridesRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    });
  });

  describe('getUserOverrides', () => {
    it('should return mapped user overrides', async () => {
      userOverridesRepo.find.mockResolvedValue([buildUserOverride()]);

      const result = await service.getUserOverrides('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].pageCode).toBe('PAGE_1');
      expect(result[0].moduleCode).toBe('MODULE_A');
    });
  });
});

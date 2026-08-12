import * as fc from 'fast-check';

import { MenuNode, MenuPageNode } from './interfaces';

/**
 * Property 4: Menu Tree Structural Invariant
 * **Validates: Requirements 4.1, 4.2**
 *
 * For any effective permissions, the menu tree:
 * - Contains only pages where canView is true
 * - Contains only active pages under active modules
 * - Pages are nested under their parent modules
 * - Modules and pages are sorted by displayOrder ascending
 * - Empty modules (zero visible pages) are excluded
 */

// --- Simulate the menu tree building logic from MenuService ---

interface PermissionInput {
  moduleCode: string;
  moduleName: string;
  moduleDisplayOrder: number;
  moduleIsActive: boolean;
  pageCode: string;
  pageName: string;
  routePath: string;
  pageDisplayOrder: number;
  pageIsActive: boolean;
  canView: boolean;
  canEdit: boolean;
  canExport: boolean;
  canDelete: boolean;
}

/**
 * Replicates the core logic from MenuService.buildMenuTree:
 * 1. Filters by canView=true, page isActive=true, module isActive=true
 * 2. Groups pages under modules
 * 3. Excludes modules with zero visible pages
 * 4. Sorts modules and pages by displayOrder ascending
 */
function buildMenuTree(permissions: PermissionInput[]): MenuNode[] {
  const moduleMap = new Map<string, MenuNode>();

  for (const perm of permissions) {
    // Req 4.1: Only include pages where canView=true, page active, module active
    if (!perm.canView) continue;
    if (!perm.moduleIsActive) continue;
    if (!perm.pageIsActive) continue;

    if (!moduleMap.has(perm.moduleCode)) {
      moduleMap.set(perm.moduleCode, {
        moduleCode: perm.moduleCode,
        moduleName: perm.moduleName,
        icon: '',
        displayOrder: perm.moduleDisplayOrder,
        pages: [],
      });
    }

    const pageNode: MenuPageNode = {
      pageCode: perm.pageCode,
      pageName: perm.pageName,
      routePath: perm.routePath,
      icon: '',
      displayOrder: perm.pageDisplayOrder,
      canView: perm.canView,
      canEdit: perm.canEdit,
      canExport: perm.canExport,
      canDelete: perm.canDelete,
    };

    moduleMap.get(perm.moduleCode)!.pages.push(pageNode);
  }

  // Req 4.1: Exclude modules with zero visible pages
  // Req 4.2: Sort modules by displayOrder, pages within each module by displayOrder
  return Array.from(moduleMap.values())
    .filter((mod) => mod.pages.length > 0)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((mod) => ({
      ...mod,
      pages: [...mod.pages].sort((a, b) => a.displayOrder - b.displayOrder),
    }));
}

// --- Arbitrary generators ---

const moduleCodeArb = fc.constantFrom('MOD_A', 'MOD_B', 'MOD_C', 'MOD_D');
const pageCodeArb = fc.stringMatching(/^PG_[A-Z]{2,5}$/);

const permissionInputArb: fc.Arbitrary<PermissionInput> = fc.record({
  moduleCode: moduleCodeArb,
  moduleName: fc.constantFrom('Module A', 'Module B', 'Module C', 'Module D'),
  moduleDisplayOrder: fc.integer({ min: 1, max: 100 }),
  moduleIsActive: fc.boolean(),
  pageCode: pageCodeArb,
  pageName: fc.string({ minLength: 3, maxLength: 20 }),
  routePath: fc.string({ minLength: 5, maxLength: 30 }),
  pageDisplayOrder: fc.integer({ min: 1, max: 100 }),
  pageIsActive: fc.boolean(),
  canView: fc.boolean(),
  canEdit: fc.boolean(),
  canExport: fc.boolean(),
  canDelete: fc.boolean(),
});

describe('Property: Menu Tree Structural Invariant (Property 4)', () => {
  it('menu tree only contains pages where canView is true', () => {
    fc.assert(
      fc.property(
        fc.array(permissionInputArb, { minLength: 1, maxLength: 20 }),
        (permissions) => {
          const tree = buildMenuTree(permissions);
          return tree.every((mod) =>
            mod.pages.every((page) => page.canView === true),
          );
        },
      ),
    );
  });

  it('menu tree only contains active pages under active modules', () => {
    fc.assert(
      fc.property(
        fc.array(permissionInputArb, { minLength: 1, maxLength: 20 }),
        (permissions) => {
          const tree = buildMenuTree(permissions);

          // Verify all pages in the tree come from active modules and are active pages
          for (const mod of tree) {
            // Find the original permission inputs for this module
            const modulePerms = permissions.filter(
              (p) => p.moduleCode === mod.moduleCode,
            );
            // At least one permission in this module must have moduleIsActive=true
            const hasActiveModule = modulePerms.some((p) => p.moduleIsActive);
            if (!hasActiveModule) return false;

            for (const page of mod.pages) {
              // The page must have come from an active page permission
              const pagePerms = permissions.filter(
                (p) =>
                  p.moduleCode === mod.moduleCode &&
                  p.pageCode === page.pageCode,
              );
              const hasActivePage = pagePerms.some((p) => p.pageIsActive);
              if (!hasActivePage) return false;
            }
          }
          return true;
        },
      ),
    );
  });

  it('modules with zero visible pages are excluded from the tree', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            moduleCode: moduleCodeArb,
            moduleName: fc.constant('Module X'),
            moduleDisplayOrder: fc.integer({ min: 1, max: 10 }),
            moduleIsActive: fc.constant(true),
            pageCode: pageCodeArb,
            pageName: fc.constant('Page X'),
            routePath: fc.constant('/page-x'),
            pageDisplayOrder: fc.integer({ min: 1, max: 10 }),
            pageIsActive: fc.constant(true),
            canView: fc.constant(false), // All pages have canView=false
            canEdit: fc.boolean(),
            canExport: fc.boolean(),
            canDelete: fc.boolean(),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (permissions) => {
          const tree = buildMenuTree(permissions);
          // No modules should appear since all pages have canView=false
          return tree.length === 0;
        },
      ),
    );
  });

  it('modules with inactive flag are excluded even if pages have canView=true', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            moduleCode: fc.constant('MOD_INACTIVE'),
            moduleName: fc.constant('Inactive Module'),
            moduleDisplayOrder: fc.integer({ min: 1, max: 10 }),
            moduleIsActive: fc.constant(false), // Module is inactive
            pageCode: pageCodeArb,
            pageName: fc.constant('Some Page'),
            routePath: fc.constant('/some-page'),
            pageDisplayOrder: fc.integer({ min: 1, max: 10 }),
            pageIsActive: fc.constant(true),
            canView: fc.constant(true), // canView is true but module inactive
            canEdit: fc.boolean(),
            canExport: fc.boolean(),
            canDelete: fc.boolean(),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (permissions) => {
          const tree = buildMenuTree(permissions);
          // Inactive modules should not appear in the tree
          return tree.every((mod) => mod.moduleCode !== 'MOD_INACTIVE');
        },
      ),
    );
  });

  it('inactive pages are excluded even if canView is true', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            moduleCode: fc.constant('MOD_A'),
            moduleName: fc.constant('Module A'),
            moduleDisplayOrder: fc.constant(1),
            moduleIsActive: fc.constant(true),
            pageCode: pageCodeArb,
            pageName: fc.constant('Inactive Page'),
            routePath: fc.constant('/inactive-page'),
            pageDisplayOrder: fc.integer({ min: 1, max: 10 }),
            pageIsActive: fc.constant(false), // Page is inactive
            canView: fc.constant(true), // canView is true but page inactive
            canEdit: fc.boolean(),
            canExport: fc.boolean(),
            canDelete: fc.boolean(),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (permissions) => {
          const tree = buildMenuTree(permissions);
          // Since all pages are inactive, no modules should appear (empty after filtering)
          return tree.length === 0;
        },
      ),
    );
  });

  it('modules are sorted by displayOrder ascending', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            moduleCode: moduleCodeArb,
            moduleName: fc.constantFrom('Module A', 'Module B', 'Module C', 'Module D'),
            moduleDisplayOrder: fc.integer({ min: 1, max: 100 }),
            moduleIsActive: fc.constant(true),
            pageCode: pageCodeArb,
            pageName: fc.string({ minLength: 3, maxLength: 10 }),
            routePath: fc.string({ minLength: 5, maxLength: 20 }),
            pageDisplayOrder: fc.integer({ min: 1, max: 100 }),
            pageIsActive: fc.constant(true),
            canView: fc.constant(true),
            canEdit: fc.boolean(),
            canExport: fc.boolean(),
            canDelete: fc.boolean(),
          }),
          { minLength: 2, maxLength: 20 },
        ),
        (permissions) => {
          const tree = buildMenuTree(permissions);
          for (let i = 1; i < tree.length; i++) {
            if (tree[i].displayOrder < tree[i - 1].displayOrder) return false;
          }
          return true;
        },
      ),
    );
  });

  it('pages within each module are sorted by displayOrder ascending', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            moduleCode: fc.constant('MOD_A'),
            moduleName: fc.constant('Module A'),
            moduleDisplayOrder: fc.constant(1),
            moduleIsActive: fc.constant(true),
            pageCode: pageCodeArb,
            pageName: fc.string({ minLength: 3, maxLength: 10 }),
            routePath: fc.string({ minLength: 5, maxLength: 20 }),
            pageDisplayOrder: fc.integer({ min: 1, max: 100 }),
            pageIsActive: fc.constant(true),
            canView: fc.constant(true),
            canEdit: fc.boolean(),
            canExport: fc.boolean(),
            canDelete: fc.boolean(),
          }),
          { minLength: 2, maxLength: 10 },
        ),
        (permissions) => {
          const tree = buildMenuTree(permissions);
          if (tree.length === 0) return true;
          const pages = tree[0].pages;
          for (let i = 1; i < pages.length; i++) {
            if (pages[i].displayOrder < pages[i - 1].displayOrder) return false;
          }
          return true;
        },
      ),
    );
  });

  it('no module in the tree has an empty pages array', () => {
    fc.assert(
      fc.property(
        fc.array(permissionInputArb, { minLength: 1, maxLength: 20 }),
        (permissions) => {
          const tree = buildMenuTree(permissions);
          return tree.every((mod) => mod.pages.length > 0);
        },
      ),
    );
  });
});

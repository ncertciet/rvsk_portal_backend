import * as fc from 'fast-check';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';
import { PageAccessGuard } from './page-access.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PAGE_ACCESS_KEY } from '../decorators/page-access.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../security/interfaces';

/**
 * Property 10: Guard Pipeline Authorization
 * **Validates: Requirements 12.2, 12.3, 12.4, 12.5**
 *
 * Tests that the guard pipeline correctly enforces authorization:
 * - RolesGuard allows if user's role is in the @Roles() list, denies otherwise
 * - PageAccessGuard allows if module+page is in the user's JWT access claim
 * - JwtAuthGuard skips validation for @Public() endpoints
 */

// --- Test helpers ---

function createMockReflector(metadata: Record<string, any>): Reflector {
  return {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
}

function createMockContext(user: AuthenticatedUser | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

// Arbitrary generators
const roleArb = fc.constantFrom(
  'Super_Admin',
  'RVSK_Admin',
  'RVSK_SPOC',
  'State_Admin',
  'District_Admin',
);

const moduleCodeArb = fc.constantFrom(
  'GRIEVANCE',
  'USERS',
  'FORMS',
  'ATTENDANCE',
  'SCHEMES',
  'HOME',
);

const pageCodeArb = fc.constantFrom(
  'GRV_LIST',
  'GRV_DETAIL',
  'GRV_CREATE',
  'USER_LIST',
  'USER_CREATE',
  'FORM_LIST',
  'FORM_CREATE',
  'ATT_DASHBOARD',
  'SCH_DASHBOARD',
);

describe('Property: Guard Pipeline Authorization (Property 10)', () => {
  describe('RolesGuard', () => {
    it('allows access when user role is in the required roles list', () => {
      fc.assert(
        fc.property(
          roleArb,
          fc.array(roleArb, { minLength: 1, maxLength: 5 }),
          (userRole, requiredRoles) => {
            // Only test cases where user role IS in the list
            fc.pre(requiredRoles.includes(userRole));

            const reflector = createMockReflector({ [ROLES_KEY]: requiredRoles });
            const guard = new RolesGuard(reflector);
            const user: AuthenticatedUser = {
              userId: 'test-uuid',
              username: 'testuser',
              role: userRole,
              stateCode: 'UP',
            };
            const context = createMockContext(user);

            return guard.canActivate(context) === true;
          },
        ),
      );
    });

    it('denies access (throws ForbiddenException) when user role is NOT in the required roles list', () => {
      fc.assert(
        fc.property(
          roleArb,
          fc.array(roleArb, { minLength: 1, maxLength: 4 }),
          (userRole, requiredRoles) => {
            // Only test cases where user role is NOT in the list
            fc.pre(!requiredRoles.includes(userRole));

            const reflector = createMockReflector({ [ROLES_KEY]: requiredRoles });
            const guard = new RolesGuard(reflector);
            const user: AuthenticatedUser = {
              userId: 'test-uuid',
              username: 'testuser',
              role: userRole,
              stateCode: 'UP',
            };
            const context = createMockContext(user);

            try {
              guard.canActivate(context);
              return false; // Should have thrown
            } catch (err) {
              return err instanceof ForbiddenException;
            }
          },
        ),
      );
    });

    it('allows any authenticated user when no @Roles() decorator is present', () => {
      fc.assert(
        fc.property(roleArb, (userRole) => {
          const reflector = createMockReflector({ [ROLES_KEY]: undefined });
          const guard = new RolesGuard(reflector);
          const user: AuthenticatedUser = {
            userId: 'test-uuid',
            username: 'testuser',
            role: userRole,
            stateCode: 'UP',
          };
          const context = createMockContext(user);

          return guard.canActivate(context) === true;
        }),
      );
    });

    it('allows any authenticated user when @Roles() has empty array', () => {
      fc.assert(
        fc.property(roleArb, (userRole) => {
          const reflector = createMockReflector({ [ROLES_KEY]: [] });
          const guard = new RolesGuard(reflector);
          const user: AuthenticatedUser = {
            userId: 'test-uuid',
            username: 'testuser',
            role: userRole,
            stateCode: 'UP',
          };
          const context = createMockContext(user);

          return guard.canActivate(context) === true;
        }),
      );
    });
  });

  describe('PageAccessGuard', () => {
    it('allows access when user access contains the required module+page', () => {
      fc.assert(
        fc.property(
          moduleCodeArb,
          fc.array(pageCodeArb, { minLength: 1, maxLength: 5 }),
          (moduleCode, pageCodes) => {
            // Pick one page from the array as the required page
            const requiredPage = pageCodes[0];
            const reflector = createMockReflector({
              [PAGE_ACCESS_KEY]: { moduleCode, pageCode: requiredPage },
            });
            const guard = new PageAccessGuard(reflector);
            const user: AuthenticatedUser = {
              userId: 'test-uuid',
              username: 'testuser',
              role: 'Super_Admin',
              stateCode: 'UP',
              access: { [moduleCode]: pageCodes },
            };
            const context = createMockContext(user);

            return guard.canActivate(context) === true;
          },
        ),
      );
    });

    it('denies access when module is absent from user access', () => {
      fc.assert(
        fc.property(
          moduleCodeArb,
          moduleCodeArb,
          pageCodeArb,
          fc.array(pageCodeArb, { minLength: 1, maxLength: 3 }),
          (requiredModule, userModule, requiredPage, userPages) => {
            // Ensure the modules are different
            fc.pre(requiredModule !== userModule);

            const reflector = createMockReflector({
              [PAGE_ACCESS_KEY]: { moduleCode: requiredModule, pageCode: requiredPage },
            });
            const guard = new PageAccessGuard(reflector);
            const user: AuthenticatedUser = {
              userId: 'test-uuid',
              username: 'testuser',
              role: 'Super_Admin',
              stateCode: 'UP',
              access: { [userModule]: userPages },
            };
            const context = createMockContext(user);

            try {
              guard.canActivate(context);
              return false; // Should have thrown
            } catch (err) {
              return err instanceof ForbiddenException;
            }
          },
        ),
      );
    });

    it('denies access when page is not in the module page list', () => {
      fc.assert(
        fc.property(
          moduleCodeArb,
          pageCodeArb,
          fc.array(pageCodeArb, { minLength: 1, maxLength: 4 }),
          (moduleCode, requiredPage, userPages) => {
            // Ensure required page is NOT in the user's page list
            fc.pre(!userPages.includes(requiredPage));

            const reflector = createMockReflector({
              [PAGE_ACCESS_KEY]: { moduleCode, pageCode: requiredPage },
            });
            const guard = new PageAccessGuard(reflector);
            const user: AuthenticatedUser = {
              userId: 'test-uuid',
              username: 'testuser',
              role: 'Super_Admin',
              stateCode: 'UP',
              access: { [moduleCode]: userPages },
            };
            const context = createMockContext(user);

            try {
              guard.canActivate(context);
              return false; // Should have thrown
            } catch (err) {
              return err instanceof ForbiddenException;
            }
          },
        ),
      );
    });

    it('allows any user when no @PageAccess() decorator is present', () => {
      fc.assert(
        fc.property(roleArb, (userRole) => {
          const reflector = createMockReflector({ [PAGE_ACCESS_KEY]: undefined });
          const guard = new PageAccessGuard(reflector);
          const user: AuthenticatedUser = {
            userId: 'test-uuid',
            username: 'testuser',
            role: userRole,
            stateCode: 'UP',
            access: {},
          };
          const context = createMockContext(user);

          return guard.canActivate(context) === true;
        }),
      );
    });

    it('denies access when user has no access map at all', () => {
      fc.assert(
        fc.property(moduleCodeArb, pageCodeArb, (moduleCode, pageCode) => {
          const reflector = createMockReflector({
            [PAGE_ACCESS_KEY]: { moduleCode, pageCode },
          });
          const guard = new PageAccessGuard(reflector);
          const user: AuthenticatedUser = {
            userId: 'test-uuid',
            username: 'testuser',
            role: 'Super_Admin',
            stateCode: 'UP',
            // No access field
          };
          const context = createMockContext(user);

          try {
            guard.canActivate(context);
            return false; // Should have thrown
          } catch (err) {
            return err instanceof ForbiddenException;
          }
        }),
      );
    });
  });

  describe('JwtAuthGuard', () => {
    it('skips validation and allows access for @Public() endpoints', () => {
      const reflector = createMockReflector({ [IS_PUBLIC_KEY]: true });
      const guard = new JwtAuthGuard(reflector);
      const context = createMockContext(null);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('skips validation for @Public() endpoints regardless of user state', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // whether user exists or not
          (hasUser) => {
            const reflector = createMockReflector({ [IS_PUBLIC_KEY]: true });
            const guard = new JwtAuthGuard(reflector);
            const user = hasUser
              ? {
                  userId: 'test-uuid',
                  username: 'testuser',
                  role: 'Super_Admin',
                  stateCode: 'UP',
                }
              : null;
            const context = createMockContext(user);

            return guard.canActivate(context) === true;
          },
        ),
      );
    });
  });
});

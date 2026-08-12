import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Sets required roles on an endpoint. RolesGuard checks the authenticated
 * user's role against this list.
 *
 * @example @Roles('Super_Admin', 'RVSK_Admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

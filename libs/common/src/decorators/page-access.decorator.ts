import { SetMetadata } from '@nestjs/common';

export const PAGE_ACCESS_KEY = 'pageAccess';

export interface PageAccessMetadata {
  moduleCode: string;
  pageCode: string;
}

/**
 * Requires page-level permission. PageAccessGuard checks the user's JWT
 * access claim contains the specified pageCode within the moduleCode key.
 *
 * @example @PageAccess('GRIEVANCE', 'GRV_LIST')
 */
export const PageAccess = (moduleCode: string, pageCode: string) =>
  SetMetadata(PAGE_ACCESS_KEY, { moduleCode, pageCode } as PageAccessMetadata);

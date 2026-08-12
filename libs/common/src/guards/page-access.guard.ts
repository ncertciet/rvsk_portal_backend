import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  PAGE_ACCESS_KEY,
  PageAccessMetadata,
} from '../decorators/page-access.decorator';
import { AuthenticatedUser } from '../security/interfaces';

/**
 * Checks @PageAccess(moduleCode, pageCode) metadata against the user's
 * JWT access claim (user.access).
 *
 * - If no @PageAccess() metadata is present, allows the request.
 * - If specified, verifies user.access[moduleCode] contains pageCode.
 * - Returns 403 if the user lacks the required page access.
 */
@Injectable()
export class PageAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const pageAccess = this.reflector.getAllAndOverride<PageAccessMetadata>(
      PAGE_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @PageAccess() decorator → allow
    if (!pageAccess) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user || !user.access) {
      throw new ForbiddenException(
        'You do not have permission to access this page',
      );
    }

    const { moduleCode, pageCode } = pageAccess;
    const modulePages = user.access[moduleCode];

    if (!modulePages || !modulePages.includes(pageCode)) {
      throw new ForbiddenException(
        'You do not have permission to access this page',
      );
    }

    return true;
  }
}

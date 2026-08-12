import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Placeholder Scope Enforcer guard.
 *
 * Actual scope filtering (state/district restriction) is handled in the
 * service layer via query conditions — the guard simply allows all requests
 * through. This keeps the guard pipeline consistent while deferring data
 * scoping to business logic.
 */
@Injectable()
export class ScopeEnforcerGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // Scope filtering is done in the service layer
    return true;
  }
}

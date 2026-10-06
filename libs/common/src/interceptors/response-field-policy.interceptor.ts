import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import {
  RESPONSE_FIELD_POLICIES_KEY,
  ResponseFieldPolicy,
} from '../decorators/response-field-policy.decorator';
import { AuthenticatedUser } from '../security/interfaces';

function omitPath(value: unknown, segments: string[]): unknown {
  if (value === null || typeof value !== 'object' || segments.length === 0) {
    return value;
  }

  const [key, ...remaining] = segments;
  if (key === '*' && Array.isArray(value)) {
    return value.map((item) => omitPath(item, remaining));
  }
  if (!Object.prototype.hasOwnProperty.call(value, key)) {
    return value;
  }

  const result = { ...value };
  if (remaining.length === 0) {
    delete result[key];
  } else {
    result[key] = omitPath(value[key], remaining);
  }
  return result;
}

@Injectable()
export class ResponseFieldPolicyInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const policies = this.reflector.getAllAndMerge<ResponseFieldPolicy[]>(
      RESPONSE_FIELD_POLICIES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!policies?.length) {
      return next.handle();
    }

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    const denied = policies.filter((policy) => !user?.role || !policy.roles.includes(user.role));
    if (!denied.length) {
      return next.handle();
    }

    return next.handle().pipe(
      map((response) => denied.reduce(
        (result, policy) => omitPath(result, policy.path.split('.')),
        response,
      )),
    );
  }
}
import { SetMetadata } from '@nestjs/common';

export const RESPONSE_FIELD_POLICIES_KEY = 'responseFieldPolicies';

export interface ResponseFieldPolicy {
  path: string;
  roles: readonly string[];
}

/** Dot-separated response paths; '*' traverses every element of an array. */
export const ResponseFieldPolicies = (...policies: ResponseFieldPolicy[]) =>
  SetMetadata(RESPONSE_FIELD_POLICIES_KEY, policies);
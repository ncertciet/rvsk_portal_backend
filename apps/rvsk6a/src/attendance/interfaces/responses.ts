import { ScopeLevel } from '../utils/scope.util';

/**
 * Standardized response envelope for the attendance dashboard (design.md §5,
 * requirements.md §5.1). Consumed by both frontend (Phase 1) and backend.
 */
export interface ResponseMeta {
  /** Data snapshot date (YYYY-MM-DD) shown on every KPI response. */
  asOfDate?: string;
  /** national | state | district — lets the FE confirm what it locked. */
  scopeLevel?: ScopeLevel;
  /** true when served from Redis, false when freshly computed. */
  cached?: boolean;
  /** Present when a % is computed from a partially-reported day. */
  reportingCoverage?: { expected: number; reported: number };
  /** true when the request was valid but yielded no data (distinct from error). */
  empty?: boolean;
}

export interface SuccessEnvelope<T> {
  success: true;
  timestamp: string;
  meta?: ResponseMeta;
  data: T;
}

export interface PaginatedData<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

/** Build a success envelope with an ISO timestamp. */
export function ok<T>(data: T, meta?: ResponseMeta): SuccessEnvelope<T> {
  return {
    success: true,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta } : {}),
    data,
  };
}

/** Build a paginated success envelope. */
export function paginated<T>(
  content: T[],
  page: number,
  size: number,
  totalElements: number,
  meta?: ResponseMeta,
): SuccessEnvelope<PaginatedData<T>> {
  return ok(
    {
      content,
      totalElements,
      totalPages: Math.ceil(totalElements / size),
      page,
      size,
    },
    meta,
  );
}

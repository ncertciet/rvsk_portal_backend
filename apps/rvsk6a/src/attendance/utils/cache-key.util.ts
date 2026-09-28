import { EffectiveScope } from './scope.util';

/**
 * Cache-key construction (design.md §4.4, requirements.md §5.2).
 *
 * Two non-negotiable namespaces:
 *   master:*  -> filter/master dropdown lists (scope-free; masters are not
 *                jurisdiction-sensitive — a district's name is the same to
 *                everyone. Scoping of WHICH masters a user may request is
 *                enforced at the endpoint, not the cache key.)
 *   dash:*    -> KPI/dashboard responses (scope-aware; see below).
 *
 * For dash:* keys the EFFECTIVE SCOPE (JWT-derived) is folded into the key so
 * that unscoped (national) users share one entry while scoped users are
 * isolated per jurisdiction — making a cross-jurisdiction cache collision
 * (hence a data leak) structurally impossible.
 */

const NS_MASTER = 'master';
const NS_DASH = 'dash:attendance';

/** master:<level>[:<parentKey>] */
export function masterKey(level: string, parentKey?: string): string {
  return parentKey ? `${NS_MASTER}:${level}:${parentKey}` : `${NS_MASTER}:${level}`;
}

/**
 * Deterministic scope segment for dash keys.
 *   national            -> scope=national   (shared by all unscoped roles)
 *   state:<stateKey>    -> isolated per state
 *   district:<distKey>  -> isolated per district
 */
function scopeSegment(scope: EffectiveScope): string {
  if (scope.level === 'district') return `scope=district:${scope.districtKey}`;
  if (scope.level === 'state') return `scope=state:${scope.stateKey}`;
  return 'scope=national';
}

/**
 * Canonical filter segment: deterministic field order, ALL for absent levels,
 * so equivalent requests map to identical keys regardless of param ordering.
 */
function filterSegment(filters: Record<string, string | number | undefined | null>): string {
  const order = [
    'date',
    'stateKey',
    'districtKey',
    'blockKey',
    'clusterKey',
    'udiseCode',
    'range',
    'fromDate',
    'toDate',
    'dimension',
    'level',
    'metric',
    'rule',
    'severity',
    'page',
    'size',
  ];
  return order
    .filter((k) => k in filters)
    .map((k) => {
      const v = filters[k];
      return `${k}=${v === undefined || v === null || v === '' ? 'ALL' : v}`;
    })
    .join('|');
}

/**
 * dash:attendance:<endpoint>:<scope>:<filters>
 */
export function dashKey(
  endpoint: string,
  scope: EffectiveScope,
  filters: Record<string, string | number | undefined | null>,
): string {
  return `${NS_DASH}:${endpoint}:${scopeSegment(scope)}:${filterSegment(filters)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redis-materialized-cache keys (design.md §14.4). The nightly cron writes these
// per geography node; the API reads them (never Oracle in production).
// ─────────────────────────────────────────────────────────────────────────────

/** Schema version prefix so the key layout can roll without stale collisions. */
const ATT_V = 'att:v1';

export type GeoLevel = 'national' | 'state' | 'district' | 'block' | 'cluster';

/** A resolved geography node: the deepest selected level + its ..._KEY. */
export interface GeoNode {
  level: GeoLevel;
  key?: string; // absent for national
}

function nodeSeg(node: GeoNode): string {
  return node.level === 'national' ? 'national' : `${node.level}:${node.key}`;
}

/** att:v1:page1:{date}:{level}[:{key}] — Page-1 daily snapshot per node. */
export function page1Key(date: string, node: GeoNode): string {
  return `${ATT_V}:page1:${date}:${nodeSeg(node)}`;
}

/** att:v1:page1school:{date} — HASH; field = UDISE_CODE (school-level Page 1). */
export function page1SchoolHashKey(date: string): string {
  return `${ATT_V}:page1school:${date}`;
}

/**
 * att:v1:series:{level}[:{key}]:{stream}
 *   stream ∈ 'student:overall' | 'student:class' | 'student:gender'
 *          | 'student:category' | 'teacher'
 * One ~6-month daily blob per node per stream (design.md §14.4 / D-3).
 */
export function seriesKey(node: GeoNode, stream: string): string {
  return `${ATT_V}:series:${nodeSeg(node)}:${stream}`;
}

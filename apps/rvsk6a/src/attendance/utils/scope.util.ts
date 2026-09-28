import { AuthenticatedUser } from '@rvsk/common';

/**
 * Effective data scope for a request, derived from the JWT (design.md §4.1/§4.2,
 * requirements.md §4). Scope is decided by the NULLNESS of the JWT geo-keys, not
 * by hardcoding role names — so any role (Ministry, Viewer, future roles) with a
 * null state_key is national, without a code change.
 */
export type ScopeLevel = 'national' | 'state' | 'district';

export interface EffectiveScope {
  level: ScopeLevel;
  /** ADW STATE_KEY (NUMBER as string). Present for state/district scope. */
  stateKey?: string;
  /** ADW DISTRICT_KEY (NUMBER as string). Present for district scope. */
  districtKey?: string;
}

/**
 * Resolve the caller's effective scope from their authenticated JWT claims.
 *   - district_key present            -> district-scoped
 *   - state_key present (no district) -> state-scoped
 *   - neither                         -> national (unscoped)
 */
export function resolveScope(user: AuthenticatedUser): EffectiveScope {
  if (user.districtKey) {
    return {
      level: 'district',
      stateKey: user.stateKey ?? undefined,
      districtKey: user.districtKey,
    };
  }
  if (user.stateKey) {
    return { level: 'state', stateKey: user.stateKey };
  }
  return { level: 'national' };
}

/**
 * Inbound geo filters from the request query (all optional, ..._KEY values).
 */
export interface GeoFilters {
  stateKey?: string;
  districtKey?: string;
  blockKey?: string;
  clusterKey?: string;
  udiseCode?: string;
}

/**
 * Merge the caller's effective scope with the inbound request filters.
 *
 * The effective scope ALWAYS wins over conflicting inbound geo params: a
 * state-scoped user cannot query another state even by tampering with the
 * query string (requirements.md §4.2, acceptance criterion 1). Below the
 * locked level the user's own filter selections are honoured.
 */
export function applyScope(scope: EffectiveScope, filters: GeoFilters): GeoFilters {
  const merged: GeoFilters = { ...filters };

  if (scope.level === 'state') {
    merged.stateKey = scope.stateKey; // force; ignore any inbound stateKey
  } else if (scope.level === 'district') {
    merged.stateKey = scope.stateKey;
    merged.districtKey = scope.districtKey; // force; ignore inbound state/district
  }

  return merged;
}

/**
 * Which hierarchy levels are locked (hidden in the UI) for this scope.
 * Presentation hint mirrored to the frontend via the config endpoint.
 */
export function lockedLevels(scope: EffectiveScope): string[] {
  if (scope.level === 'district') return ['state', 'district'];
  if (scope.level === 'state') return ['state'];
  return [];
}

/**
 * The deepest geography node selected, after scope enforcement. Determines which
 * pre-computed Redis node blob the request reads (design.md §14.5). School
 * (udiseCode) is handled separately (school hash), so it is NOT a node level
 * here — a udiseCode selection resolves to its parent cluster/block/... node for
 * series, and to the school hash for Page-1.
 */
export type NodeLevel = 'national' | 'state' | 'district' | 'block' | 'cluster';

export interface ResolvedNode {
  level: NodeLevel;
  key?: string;
}

export function resolveNode(merged: GeoFilters): ResolvedNode {
  if (merged.clusterKey) return { level: 'cluster', key: merged.clusterKey };
  if (merged.blockKey) return { level: 'block', key: merged.blockKey };
  if (merged.districtKey) return { level: 'district', key: merged.districtKey };
  if (merged.stateKey) return { level: 'state', key: merged.stateKey };
  return { level: 'national' };
}

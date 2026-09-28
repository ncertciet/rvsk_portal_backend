/**
 * Typed row shapes returned by the ADW replica master views (design.md §6.2).
 * Column aliases are lowerCamel to match the aliased SELECT output the FE consumes.
 * The join/cascade key is always the numeric ..._KEY (aligned with JWT claims);
 * the ..._ID is a separate business/display code.
 */

export interface StateOption {
  stateKey: string;
  stateId: string;
  stateName: string;
}

export interface DistrictOption {
  districtKey: string;
  districtId: string;
  districtName: string;
}

export interface BlockOption {
  blockKey: string;
  blockId: string;
  blockName: string;
}

export interface ClusterOption {
  clusterKey: string;
  clusterId: string;
  clusterName: string;
}

export interface SchoolOption {
  udiseCode: string;
  schoolName: string;
}

/** Dashboard filter configuration served by GET /attendance/config (design.md §6.3). */
export interface FilterConfig {
  dashboardId: string;
  levels: string[];
  required: string[];
  searchable: string[];
  defaultScope: { level: string; value: string | null };
  /** Levels hidden/locked for the caller's scope (presentation hint). */
  lockedLevels: string[];
}

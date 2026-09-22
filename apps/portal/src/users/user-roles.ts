/**
 * RVSK-USR-MGMT-001 — Role definitions and role-driven rules shared by the
 * user create/edit flow (authority, geo requirements) and tests.
 */

export const ALL_ROLES = [
  'Super_Admin',
  'RVSK_Admin',
  'Ministry_Admin',
  'RVSK_SPOC',
  'Viewer',
  'State_Admin',
  'District_Admin',
  'Block_Admin',
] as const;

export type Role = (typeof ALL_ROLES)[number];

/** Roles that must NOT carry any State/District/Block scope. */
export const NON_GEO_ROLES: ReadonlySet<string> = new Set([
  'Super_Admin',
  'RVSK_Admin',
  'Ministry_Admin',
  'RVSK_SPOC',
  'Viewer',
]);

/** Geo-scoped roles and the depth of chain each one requires. */
export type GeoLevel = 'state' | 'district' | 'block';

export const GEO_ROLE_LEVEL: Readonly<Record<string, GeoLevel>> = {
  State_Admin: 'state',
  District_Admin: 'district',
  Block_Admin: 'block',
};

export function isValidRole(role: string): boolean {
  return (ALL_ROLES as readonly string[]).includes(role);
}

export function isNonGeoRole(role: string): boolean {
  return NON_GEO_ROLES.has(role);
}

export function isGeoRole(role: string): boolean {
  return role in GEO_ROLE_LEVEL;
}

export function geoLevelForRole(role: string): GeoLevel | null {
  return GEO_ROLE_LEVEL[role] ?? null;
}

/**
 * Role-based creation authority (spec .1).
 * - Super_Admin may create any role.
 * - RVSK_Admin may create any role EXCEPT Super_Admin.
 * - No other role may create users (enforced at controller by @Roles).
 * Returns true when `callerRole` is permitted to create `targetRole`.
 */
export function canCreateRole(callerRole: string, targetRole: string): boolean {
  if (callerRole === 'Super_Admin') return true;
  if (callerRole === 'RVSK_Admin') return targetRole !== 'Super_Admin';
  return false;
}

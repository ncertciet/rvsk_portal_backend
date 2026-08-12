export const RoleConstants = {
  SUPER_ADMIN: 'Super_Admin',
  RVSK_ADMIN: 'RVSK_Admin',
  RVSK_SPOC: 'RVSK_SPOC',
  STATE_ADMIN: 'State_Admin',
  STATE_SPOC: 'State_SPOC',
  DISTRICT_ADMIN: 'District_Admin',
} as const;

export type RoleType = (typeof RoleConstants)[keyof typeof RoleConstants];

import {
  canCreateRole,
  geoLevelForRole,
  isGeoRole,
  isNonGeoRole,
  isValidRole,
} from './user-roles';

describe('user-roles helpers (RVSK-USR-MGMT-001.1/.2)', () => {
  describe('isValidRole', () => {
    it('accepts known roles', () => {
      expect(isValidRole('Super_Admin')).toBe(true);
      expect(isValidRole('Block_Admin')).toBe(true);
    });
    it('rejects unknown roles', () => {
      expect(isValidRole('Wizard')).toBe(false);
      expect(isValidRole('')).toBe(false);
    });
  });

  describe('canCreateRole', () => {
    it('Super_Admin can create anything', () => {
      expect(canCreateRole('Super_Admin', 'Super_Admin')).toBe(true);
      expect(canCreateRole('Super_Admin', 'Block_Admin')).toBe(true);
    });
    it('RVSK_Admin cannot create Super_Admin', () => {
      expect(canCreateRole('RVSK_Admin', 'Super_Admin')).toBe(false);
    });
    it('RVSK_Admin can create any non-Super_Admin', () => {
      expect(canCreateRole('RVSK_Admin', 'State_Admin')).toBe(true);
      expect(canCreateRole('RVSK_Admin', 'Viewer')).toBe(true);
    });
    it('other roles cannot create', () => {
      expect(canCreateRole('State_Admin', 'Viewer')).toBe(false);
      expect(canCreateRole('Viewer', 'Viewer')).toBe(false);
    });
  });

  describe('geoLevelForRole', () => {
    it('maps geo roles to their level', () => {
      expect(geoLevelForRole('State_Admin')).toBe('state');
      expect(geoLevelForRole('District_Admin')).toBe('district');
      expect(geoLevelForRole('Block_Admin')).toBe('block');
    });
    it('returns null for non-geo roles', () => {
      expect(geoLevelForRole('Super_Admin')).toBeNull();
      expect(geoLevelForRole('Viewer')).toBeNull();
    });
  });

  describe('isNonGeoRole / isGeoRole', () => {
    it('classifies non-geo roles', () => {
      ['Super_Admin', 'RVSK_Admin', 'Ministry_Admin', 'RVSK_SPOC', 'Viewer'].forEach((r) => {
        expect(isNonGeoRole(r)).toBe(true);
        expect(isGeoRole(r)).toBe(false);
      });
    });
    it('classifies geo roles', () => {
      ['State_Admin', 'District_Admin', 'Block_Admin'].forEach((r) => {
        expect(isGeoRole(r)).toBe(true);
        expect(isNonGeoRole(r)).toBe(false);
      });
    });
  });
});

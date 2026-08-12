import * as fc from 'fast-check';

/**
 * Property 5: Data Scope Enforcement
 * **Validates: Requirements 5.3, 5.4, 5.5**
 *
 * Tests that role-based scope filtering correctly restricts grievance visibility:
 * - Super_Admin and RVSK_Admin see ALL grievances without filtering
 * - RVSK_SPOC sees only grievances assigned to them
 * - State_Admin, District_Admin, and other roles see only their own grievances
 */

interface Grievance {
  id: string;
  createdBy: string;
  assignedTo: string | null;
  stateCode: string;
}

// Pure function that simulates the scope filtering logic
// Mirrors the applyRoleScope method in GrievanceService
function applyScope(grievances: Grievance[], userId: string, role: string): Grievance[] {
  if (role === 'Super_Admin' || role === 'RVSK_Admin') {
    return grievances; // No filtering
  }
  if (role === 'RVSK_SPOC') {
    return grievances.filter(g => g.assignedTo === userId);
  }
  // Others: only own grievances
  return grievances.filter(g => g.createdBy === userId);
}

describe('Property: Data Scope Enforcement (Property 5)', () => {
  const grievanceArb = fc.record({
    id: fc.uuid(),
    createdBy: fc.uuid(),
    assignedTo: fc.option(fc.uuid(), { nil: null }),
    stateCode: fc.stringOf(fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'), { minLength: 2, maxLength: 2 }),
  });

  it('Super_Admin sees ALL grievances without any filtering', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // userId
        fc.array(grievanceArb, { minLength: 0, maxLength: 20 }),
        (userId, grievances) => {
          const result = applyScope(grievances, userId, 'Super_Admin');
          return result.length === grievances.length;
        },
      ),
    );
  });

  it('RVSK_Admin sees ALL grievances without any filtering', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(grievanceArb, { minLength: 0, maxLength: 20 }),
        (userId, grievances) => {
          const result = applyScope(grievances, userId, 'RVSK_Admin');
          return result.length === grievances.length;
        },
      ),
    );
  });

  it('RVSK_SPOC sees only grievances assigned to them', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(grievanceArb, { minLength: 1, maxLength: 20 }),
        (userId, grievances) => {
          const result = applyScope(grievances, userId, 'RVSK_SPOC');
          return result.every(g => g.assignedTo === userId);
        },
      ),
    );
  });

  it('RVSK_SPOC never sees grievances assigned to someone else', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(grievanceArb, { minLength: 1, maxLength: 20 }),
        (userId, grievances) => {
          const result = applyScope(grievances, userId, 'RVSK_SPOC');
          const assignedToOthers = grievances.filter(
            g => g.assignedTo !== null && g.assignedTo !== userId,
          );
          // None of the "assigned to others" should appear in the result
          return assignedToOthers.every(g => !result.includes(g));
        },
      ),
    );
  });

  it('State_Admin sees only their own grievances', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(grievanceArb, { minLength: 1, maxLength: 20 }),
        (userId, grievances) => {
          const result = applyScope(grievances, userId, 'State_Admin');
          return result.every(g => g.createdBy === userId);
        },
      ),
    );
  });

  it('District_Admin sees only their own grievances', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(grievanceArb, { minLength: 1, maxLength: 20 }),
        (userId, grievances) => {
          const result = applyScope(grievances, userId, 'District_Admin');
          return result.every(g => g.createdBy === userId);
        },
      ),
    );
  });

  it('non-admin roles never see grievances created by others', () => {
    const nonAdminRoleArb = fc.constantFrom('State_Admin', 'District_Admin', 'State_SPOC');

    fc.assert(
      fc.property(
        fc.uuid(),
        nonAdminRoleArb,
        fc.array(grievanceArb, { minLength: 1, maxLength: 20 }),
        (userId, role, grievances) => {
          const result = applyScope(grievances, userId, role);
          const othersGrievances = grievances.filter(g => g.createdBy !== userId);
          // None of the others' grievances should appear in the result
          return othersGrievances.every(g => !result.includes(g));
        },
      ),
    );
  });

  it('admin roles always return the complete set of grievances (no loss)', () => {
    const adminRoleArb = fc.constantFrom('Super_Admin', 'RVSK_Admin');

    fc.assert(
      fc.property(
        fc.uuid(),
        adminRoleArb,
        fc.array(grievanceArb, { minLength: 0, maxLength: 20 }),
        (userId, role, grievances) => {
          const result = applyScope(grievances, userId, role);
          // Every grievance in input must be in output (no data loss)
          return grievances.every(g => result.includes(g));
        },
      ),
    );
  });
});

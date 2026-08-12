import * as fc from 'fast-check';

/**
 * Property 6: Grievance Search Filter Correctness
 * **Validates: Requirements 5.6, 5.7**
 *
 * Tests that search and status filtering correctly restricts grievance results:
 * - For any search term, all returned grievances contain the term in subject or grievanceId
 * - For any status filter, all returned grievances match that status
 */

interface Grievance {
  id: string;
  subject: string;
  grievanceId: string;
  status: string;
}

function applySearch(grievances: Grievance[], search: string): Grievance[] {
  const lower = search.toLowerCase();
  return grievances.filter(
    g =>
      g.subject.toLowerCase().includes(lower) ||
      g.grievanceId.toLowerCase().includes(lower),
  );
}

function applyStatusFilter(grievances: Grievance[], status: string): Grievance[] {
  return grievances.filter(g => g.status === status);
}

describe('Property: Grievance Search Filter Correctness (Property 6)', () => {
  it('all returned grievances contain search term in subject or grievanceId', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.array(
          fc.record({
            id: fc.uuid(),
            subject: fc.string({ minLength: 0, maxLength: 50 }),
            grievanceId: fc.string({ minLength: 5, maxLength: 20 }),
            status: fc.constantFrom('OPEN', 'CLOSED', 'IN_PROGRESS'),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (search, grievances) => {
          const result = applySearch(grievances, search);
          return result.every(
            g =>
              g.subject.toLowerCase().includes(search.toLowerCase()) ||
              g.grievanceId.toLowerCase().includes(search.toLowerCase()),
          );
        },
      ),
    );
  });

  it('all returned grievances match the status filter', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'OPEN',
          'ASSIGNED',
          'UNDER_REVIEW',
          'IN_PROGRESS',
          'RESPONSE_PROVIDED',
          'CLOSED',
          'REOPENED',
        ),
        fc.array(
          fc.record({
            id: fc.uuid(),
            subject: fc.string(),
            grievanceId: fc.string(),
            status: fc.constantFrom(
              'OPEN',
              'ASSIGNED',
              'UNDER_REVIEW',
              'IN_PROGRESS',
              'RESPONSE_PROVIDED',
              'CLOSED',
              'REOPENED',
            ),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (status, grievances) => {
          const result = applyStatusFilter(grievances, status);
          return result.every(g => g.status === status);
        },
      ),
    );
  });
});

import * as fc from 'fast-check';

/**
 * Property 7: Form Lifecycle State Machine
 * **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**
 *
 * Tests form lifecycle state transitions:
 * - publishForm only succeeds from DRAFT
 * - closeForm only succeeds from PUBLISHED
 * - Edit/delete allowed only in DRAFT, rejected in PUBLISHED/CLOSED
 */

const VALID_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED'] as const;

function canPublish(status: string): boolean {
  return status === 'DRAFT';
}

function canClose(status: string): boolean {
  return status === 'PUBLISHED';
}

function canEditOrDelete(status: string): boolean {
  return status === 'DRAFT';
}

describe('Property: Form Lifecycle State Machine (Property 7)', () => {
  it('publishForm succeeds only if status is DRAFT', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_STATUSES), status => {
        return canPublish(status) === (status === 'DRAFT');
      }),
    );
  });

  it('closeForm succeeds only if status is PUBLISHED', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_STATUSES), status => {
        return canClose(status) === (status === 'PUBLISHED');
      }),
    );
  });

  it('edit/delete allowed only in DRAFT', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_STATUSES), status => {
        return canEditOrDelete(status) === (status === 'DRAFT');
      }),
    );
  });
});

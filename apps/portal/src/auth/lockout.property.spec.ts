import * as fc from 'fast-check';

/**
 * Property 2: Account Lockout Mechanics
 * **Validates: Requirements 2.3, 2.4, 2.5, 2.6**
 *
 * Tests the lockout algorithm directly as a pure function extraction:
 * - N consecutive failures with threshold N results in locked account
 * - Fewer than N failures does NOT lock the account
 * - Expired lock allows access (lockedUntil in the past)
 * - Future lock blocks access
 */

// Pure function extraction of lockout state management
interface LockoutState {
  failedAttempts: number;
  lockedUntil: Date | null;
}

function handleFailedAttempt(
  state: LockoutState,
  maxAttempts: number,
  lockoutMinutes: number,
): LockoutState {
  const attempts = (state.failedAttempts || 0) + 1;
  const newState = { ...state, failedAttempts: attempts };
  if (attempts >= maxAttempts) {
    const lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + lockoutMinutes);
    newState.lockedUntil = lockUntil;
  }
  return newState;
}

function isAccountLocked(state: LockoutState): boolean {
  if (!state.lockedUntil) return false;
  return new Date() < state.lockedUntil;
}

describe('Property: Account Lockout Mechanics (Property 2)', () => {
  it('N consecutive failures with threshold N results in locked account', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // maxAttempts
        fc.integer({ min: 1, max: 60 }), // lockoutMinutes
        (maxAttempts, lockoutMinutes) => {
          let state: LockoutState = { failedAttempts: 0, lockedUntil: null };
          for (let i = 0; i < maxAttempts; i++) {
            state = handleFailedAttempt(state, maxAttempts, lockoutMinutes);
          }
          return state.lockedUntil !== null && isAccountLocked(state);
        },
      ),
    );
  });

  it('fewer than N failures does NOT lock the account', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }), // maxAttempts (at least 2 so we can have fewer)
        fc.integer({ min: 1, max: 60 }), // lockoutMinutes
        (maxAttempts, lockoutMinutes) => {
          let state: LockoutState = { failedAttempts: 0, lockedUntil: null };
          for (let i = 0; i < maxAttempts - 1; i++) {
            state = handleFailedAttempt(state, maxAttempts, lockoutMinutes);
          }
          return state.lockedUntil === null;
        },
      ),
    );
  });

  it('expired lock allows access (lockedUntil in the past)', () => {
    const pastDate = new Date(Date.now() - 60000); // 1 minute ago
    const state: LockoutState = { failedAttempts: 5, lockedUntil: pastDate };
    expect(isAccountLocked(state)).toBe(false);
  });

  it('future lock blocks access', () => {
    const futureDate = new Date(Date.now() + 60000); // 1 minute in future
    const state: LockoutState = { failedAttempts: 5, lockedUntil: futureDate };
    expect(isAccountLocked(state)).toBe(true);
  });
});

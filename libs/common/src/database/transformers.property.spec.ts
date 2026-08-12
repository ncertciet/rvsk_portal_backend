import * as fc from 'fast-check';
import { OracleUuidTransformer, formatUuid } from './uuid.transformer';
import { OracleBooleanTransformer } from './boolean.transformer';

/**
 * Property 9: Oracle Type Transformer Round-Trip
 * **Validates: Requirements 10.4, 10.5**
 *
 * Verifies that Oracle type transformers (UUID and Boolean) correctly perform
 * round-trip conversions and handle null/undefined inputs.
 */
describe('Property: Oracle Type Transformer Round-Trip (Property 9)', () => {
  describe('UUID Transformer', () => {
    it('any valid UUID string → Buffer → UUID produces the original', () => {
      fc.assert(
        fc.property(fc.uuid(), (uuid) => {
          const buffer = OracleUuidTransformer.to(uuid);
          const result = OracleUuidTransformer.from(buffer);
          return result === uuid.toLowerCase();
        }),
      );
    });

    it('null input → null output (to direction)', () => {
      expect(OracleUuidTransformer.to(null)).toBeNull();
      expect(OracleUuidTransformer.to(undefined)).toBeNull();
    });

    it('null input → null output (from direction)', () => {
      expect(OracleUuidTransformer.from(null)).toBeNull();
      expect(OracleUuidTransformer.from(undefined)).toBeNull();
    });

    it('buffer is always 16 bytes for valid UUIDs', () => {
      fc.assert(
        fc.property(fc.uuid(), (uuid) => {
          const buffer = OracleUuidTransformer.to(uuid);
          return buffer !== null && buffer.length === 16;
        }),
      );
    });
  });

  describe('Boolean Transformer', () => {
    it('true → 1 → true round-trip', () => {
      const num = OracleBooleanTransformer.to(true);
      expect(num).toBe(1);
      expect(OracleBooleanTransformer.from(num)).toBe(true);
    });

    it('false → 0 → false round-trip', () => {
      const num = OracleBooleanTransformer.to(false);
      expect(num).toBe(0);
      expect(OracleBooleanTransformer.from(num)).toBe(false);
    });

    it('null/undefined → null (to direction)', () => {
      expect(OracleBooleanTransformer.to(null)).toBeNull();
      expect(OracleBooleanTransformer.to(undefined)).toBeNull();
    });

    it('only 1 maps to true, everything else to false', () => {
      fc.assert(
        fc.property(fc.integer(), (n) => {
          const result = OracleBooleanTransformer.from(n);
          return n === 1 ? result === true : result === false;
        }),
      );
    });
  });
});

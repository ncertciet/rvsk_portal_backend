import { ValueTransformer } from 'typeorm';

/**
 * TypeORM ValueTransformer for Oracle NUMBER(1) ↔ boolean conversion.
 *
 * - to(): true → 1, false → 0, null/undefined → null
 * - from(): 1 → true, anything else (0, null, other) → false
 */
export const OracleBooleanTransformer: ValueTransformer = {
  /**
   * Convert boolean to NUMBER(1) for storage in Oracle.
   */
  to(value: boolean | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    return value ? 1 : 0;
  },

  /**
   * Convert NUMBER(1) from Oracle to boolean.
   * Treats 1, '1', and truthy number values as true; everything else is false.
   * Oracle thin driver may return numbers as strings in some configurations.
   */
  from(value: number | string | null | undefined): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    return value == 1;
  },
};

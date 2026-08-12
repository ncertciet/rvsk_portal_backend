import { ValueTransformer } from 'typeorm';

/**
 * Adds dashes to a 32-character hex string to produce UUID format (8-4-4-4-12).
 * @param hex - 32-character hexadecimal string
 * @returns UUID string in 8-4-4-4-12 format
 */
export function formatUuid(hex: string): string {
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join('-');
}

/**
 * TypeORM ValueTransformer for Oracle RAW(16) ↔ UUID string conversion.
 *
 * - to(): Converts a UUID string (8-4-4-4-12 format with dashes) to a 16-byte Buffer.
 *   Returns null for null/undefined input.
 * - from(): Converts a 16-byte Buffer to a lowercase UUID string with dashes (8-4-4-4-12).
 *   Returns null for null/undefined input.
 */
export const OracleUuidTransformer: ValueTransformer = {
  /**
   * Convert UUID string to 16-byte Buffer for storage in Oracle RAW(16).
   */
  to(value: string | null | undefined): Buffer | null {
    if (value === null || value === undefined) {
      return null;
    }
    const hex = value.replace(/-/g, '');
    return Buffer.from(hex, 'hex');
  },

  /**
   * Convert 16-byte Buffer from Oracle RAW(16) to lowercase UUID string.
   */
  from(value: Buffer | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const hex = Buffer.from(value).toString('hex').toLowerCase();
    return formatUuid(hex);
  },
};

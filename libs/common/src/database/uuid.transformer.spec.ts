import { OracleUuidTransformer, formatUuid } from './uuid.transformer';

describe('OracleUuidTransformer', () => {
  describe('formatUuid', () => {
    it('should add dashes to a 32-char hex string in 8-4-4-4-12 format', () => {
      const hex = '550e8400e29b41d4a716446655440000';
      expect(formatUuid(hex)).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should produce lowercase output for lowercase input', () => {
      const hex = 'abcdef0123456789abcdef0123456789';
      expect(formatUuid(hex)).toBe('abcdef01-2345-6789-abcd-ef0123456789');
    });
  });

  describe('to()', () => {
    it('should convert a UUID string to a 16-byte Buffer', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = OracleUuidTransformer.to(uuid);
      expect(result).toBeInstanceOf(Buffer);
      expect(result!.length).toBe(16);
      expect(result!.toString('hex')).toBe('550e8400e29b41d4a716446655440000');
    });

    it('should return null for null input', () => {
      expect(OracleUuidTransformer.to(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(OracleUuidTransformer.to(undefined)).toBeNull();
    });
  });

  describe('from()', () => {
    it('should convert a 16-byte Buffer to lowercase UUID string with dashes', () => {
      const buffer = Buffer.from('550e8400e29b41d4a716446655440000', 'hex');
      const result = OracleUuidTransformer.from(buffer);
      expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return lowercase hex even for uppercase buffer content', () => {
      const buffer = Buffer.from('ABCDEF0123456789ABCDEF0123456789', 'hex');
      const result = OracleUuidTransformer.from(buffer);
      expect(result).toBe('abcdef01-2345-6789-abcd-ef0123456789');
    });

    it('should return null for null input', () => {
      expect(OracleUuidTransformer.from(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(OracleUuidTransformer.from(undefined)).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('should round-trip a UUID correctly (to → from)', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const buffer = OracleUuidTransformer.to(uuid);
      const result = OracleUuidTransformer.from(buffer);
      expect(result).toBe(uuid);
    });
  });
});

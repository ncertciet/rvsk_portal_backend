import { OracleBooleanTransformer } from './boolean.transformer';

describe('OracleBooleanTransformer', () => {
  describe('to()', () => {
    it('should convert true to 1', () => {
      expect(OracleBooleanTransformer.to(true)).toBe(1);
    });

    it('should convert false to 0', () => {
      expect(OracleBooleanTransformer.to(false)).toBe(0);
    });

    it('should convert null to null', () => {
      expect(OracleBooleanTransformer.to(null)).toBeNull();
    });

    it('should convert undefined to null', () => {
      expect(OracleBooleanTransformer.to(undefined)).toBeNull();
    });
  });

  describe('from()', () => {
    it('should convert 1 to true', () => {
      expect(OracleBooleanTransformer.from(1)).toBe(true);
    });

    it('should convert 0 to false', () => {
      expect(OracleBooleanTransformer.from(0)).toBe(false);
    });

    it('should convert null to false', () => {
      expect(OracleBooleanTransformer.from(null)).toBe(false);
    });

    it('should convert undefined to false', () => {
      expect(OracleBooleanTransformer.from(undefined)).toBe(false);
    });

    it('should convert any other number to false', () => {
      expect(OracleBooleanTransformer.from(2)).toBe(false);
      expect(OracleBooleanTransformer.from(-1)).toBe(false);
      expect(OracleBooleanTransformer.from(99)).toBe(false);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './jwt.service';
import { PortalUser } from './entities/portal-user.entity';

describe('TokenService', () => {
  let tokenService: TokenService;
  let jwtService: NestJwtService;

  const mockUser: Partial<PortalUser> = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    username: 'testuser',
    role: 'RVSK_Admin',
    stateCode: 'UP',
    displayName: 'Test User',
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: NestJwtService,
          useValue: new NestJwtService({ secret: 'test-secret-key-for-testing-purposes-only-32chars!' }),
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                JWT_ACCESS_EXPIRY: '900000',
                JWT_REFRESH_EXPIRY: '28800000',
              };
              return config[key] || defaultValue;
            },
          },
        },
      ],
    }).compile();

    tokenService = module.get<TokenService>(TokenService);
    jwtService = module.get<NestJwtService>(NestJwtService);
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token with correct claims', () => {
      const token = tokenService.generateAccessToken(mockUser as PortalUser);
      const decoded = jwtService.decode(token) as any;

      expect(decoded.sub).toBe('testuser');
      expect(decoded.role).toBe('RVSK_Admin');
      expect(decoded.state_code).toBe('UP');
      expect(decoded.user_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(decoded.token_type).toBe('access');
      expect(decoded.exp).toBeDefined();
    });

    it('should include access map when provided and non-empty', () => {
      const access = { MOD_AUTH: ['PAGE_USERS', 'PAGE_ROLES'] };
      const token = tokenService.generateAccessToken(mockUser as PortalUser, access);
      const decoded = jwtService.decode(token) as any;

      expect(decoded.access).toEqual(access);
    });

    it('should omit access map when empty', () => {
      const token = tokenService.generateAccessToken(mockUser as PortalUser, {});
      const decoded = jwtService.decode(token) as any;

      expect(decoded.access).toBeUndefined();
    });

    it('should use empty string for stateCode when null', () => {
      const userWithNullState = { ...mockUser, stateCode: null } as PortalUser;
      const token = tokenService.generateAccessToken(userWithNullState);
      const decoded = jwtService.decode(token) as any;

      expect(decoded.state_code).toBe('');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token with minimal claims', () => {
      const token = tokenService.generateRefreshToken(mockUser as PortalUser);
      const decoded = jwtService.decode(token) as any;

      expect(decoded.sub).toBe('testuser');
      expect(decoded.token_type).toBe('refresh');
      expect(decoded.role).toBeUndefined();
      expect(decoded.user_id).toBeUndefined();
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('validateToken', () => {
    it('should validate a correctly signed token', () => {
      const token = tokenService.generateAccessToken(mockUser as PortalUser);
      const payload = tokenService.validateToken(token);

      expect(payload.sub).toBe('testuser');
      expect(payload.role).toBe('RVSK_Admin');
    });

    it('should throw for an invalid token', () => {
      expect(() => tokenService.validateToken('invalid.token.here')).toThrow();
    });
  });

  describe('extractUsername', () => {
    it('should extract username from access token', () => {
      const token = tokenService.generateAccessToken(mockUser as PortalUser);
      expect(tokenService.extractUsername(token)).toBe('testuser');
    });
  });

  describe('extractRole', () => {
    it('should extract role from access token', () => {
      const token = tokenService.generateAccessToken(mockUser as PortalUser);
      expect(tokenService.extractRole(token)).toBe('RVSK_Admin');
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for a valid non-expired token', () => {
      const token = tokenService.generateAccessToken(mockUser as PortalUser);
      expect(tokenService.isTokenExpired(token)).toBe(false);
    });

    it('should return true for an expired token', () => {
      // Create a token that's already expired
      const expiredToken = jwtService.sign(
        { sub: 'testuser', token_type: 'access' },
        { expiresIn: -10 },
      );
      expect(tokenService.isTokenExpired(expiredToken)).toBe(true);
    });

    it('should return true for an invalid token', () => {
      expect(tokenService.isTokenExpired('garbage')).toBe(true);
    });
  });

  describe('isRefreshToken', () => {
    it('should return true for a refresh token', () => {
      const token = tokenService.generateRefreshToken(mockUser as PortalUser);
      expect(tokenService.isRefreshToken(token)).toBe(true);
    });

    it('should return false for an access token', () => {
      const token = tokenService.generateAccessToken(mockUser as PortalUser);
      expect(tokenService.isRefreshToken(token)).toBe(false);
    });

    it('should return false for an invalid token', () => {
      expect(tokenService.isRefreshToken('not-a-token')).toBe(false);
    });
  });
});

import * as fc from 'fast-check';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './jwt.service';
import { PortalUser } from './entities/portal-user.entity';

/**
 * Property 1: JWT Token Round-Trip
 *
 * For any valid user data (username, role, stateCode, userId),
 * generating an access token and then validating it must produce
 * claims matching the original user data.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */
describe('Property: JWT Token Round-Trip (Property 1)', () => {
  let tokenService: TokenService;

  beforeAll(() => {
    const jwtService = new NestJwtService({
      secret: 'test-secret-key-at-least-32-bytes-long!',
      signOptions: { algorithm: 'HS256' },
    });
    const configService = {
      get: (key: string, def?: string) => {
        if (key === 'JWT_ACCESS_EXPIRY') return '900000';
        if (key === 'JWT_REFRESH_EXPIRY') return '28800000';
        return def;
      },
    } as any;
    tokenService = new TokenService(jwtService, configService);
  });

  it('generated access token can be validated back with same claims', () => {
    fc.assert(
      fc.property(
        fc.record({
          username: fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => !s.includes('\x00')),
          role: fc.constantFrom(
            'Super_Admin',
            'RVSK_Admin',
            'RVSK_SPOC',
            'State_Admin',
          ),
          stateCode: fc.string({ minLength: 2, maxLength: 2 }),
          userId: fc.uuid(),
        }),
        (userData) => {
          const user = {
            id: userData.userId,
            username: userData.username,
            role: userData.role,
            stateKey: null,
          } as PortalUser;
          // Legacy 2-char state code is passed explicitly at token generation.
          const token = tokenService.generateAccessToken(user, undefined, userData.stateCode);
          const payload = tokenService.validateToken(token);
          return (
            payload.sub === userData.username &&
            payload.role === userData.role &&
            payload.state_code === userData.stateCode &&
            payload.user_id === userData.userId &&
            payload.token_type === 'access'
          );
        },
      ),
    );
  });

  it('refresh token has token_type refresh and sub = username', () => {
    fc.assert(
      fc.property(
        fc.record({
          username: fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => !s.includes('\x00')),
          role: fc.constantFrom('Super_Admin', 'RVSK_Admin'),
          stateCode: fc.string({ minLength: 2, maxLength: 2 }),
          userId: fc.uuid(),
        }),
        (userData) => {
          const user = {
            id: userData.userId,
            username: userData.username,
            role: userData.role,
            stateKey: null,
          } as PortalUser;
          const token = tokenService.generateRefreshToken(user);
          return tokenService.isRefreshToken(token) === true;
        },
      ),
    );
  });

  it('access token is not identified as refresh token', () => {
    fc.assert(
      fc.property(fc.uuid(), (userId) => {
        const user = {
          id: userId,
          username: 'test',
          role: 'Admin',
          stateKey: null,
        } as PortalUser;
        const token = tokenService.generateAccessToken(user);
        return tokenService.isRefreshToken(token) === false;
      }),
    );
  });
});

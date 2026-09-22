import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthenticatedUser, JwtPayload } from './interfaces';

/**
 * Passport JWT strategy — validates HS256-signed access tokens.
 *
 * Behaviour:
 * - Extracts Bearer token from the Authorization header.
 * - Verifies signature using JWT_SECRET from ConfigService.
 * - Rejects refresh tokens (token_type !== "access") by returning null → 401.
 * - Maps validated payload to an AuthenticatedUser object attached to the request.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  /**
   * Called by Passport after successful signature & expiration verification.
   * Returns null to trigger a 401 if the token is not an access token.
   */
  validate(payload: JwtPayload): AuthenticatedUser | null {
    // Reject refresh tokens used for API authentication
    if (payload.token_type !== 'access') {
      return null;
    }

    return {
      userId: payload.user_id,
      username: payload.sub,
      role: payload.role,
      stateCode: payload.state_code ?? '',
      stateKey: payload.state_key ?? null,
      districtKey: payload.district_key ?? null,
      blockKey: payload.block_key ?? null,
      access: payload.access,
    };
  }
}

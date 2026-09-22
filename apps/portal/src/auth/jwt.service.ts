import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PortalUser } from './entities/portal-user.entity';
import { JwtPayload } from '@rvsk/common';

@Injectable()
export class TokenService {
  private readonly accessExpiry: number;
  private readonly refreshExpiry: number;

  constructor(
    private readonly jwtService: NestJwtService,
    private readonly config: ConfigService,
  ) {
    this.accessExpiry = parseInt(config.get('JWT_ACCESS_EXPIRY', '900000'), 10); // 15 min
    this.refreshExpiry = parseInt(config.get('JWT_REFRESH_EXPIRY', '28800000'), 10); // 8 hr
  }

  generateAccessToken(
    user: PortalUser,
    access?: Record<string, string[]>,
    legacyStateCode?: string,
  ): string {
    const payload: Partial<JwtPayload> = {
      sub: user.username,
      role: user.role,
      // Legacy 2-char state code (state_id) for backward-compatible domains.
      state_code: legacyStateCode ?? '',
      state_key: user.stateKey ?? null,
      district_key: user.districtKey ?? null,
      block_key: user.blockKey ?? null,
      user_id: user.id,
      token_type: 'access',
    };
    if (access && Object.keys(access).length > 0) {
      payload.access = access;
    }
    return this.jwtService.sign(payload as any, {
      expiresIn: Math.floor(this.accessExpiry / 1000), // seconds
    });
  }

  generateRefreshToken(user: PortalUser): string {
    return this.jwtService.sign(
      { sub: user.username, token_type: 'refresh' },
      { expiresIn: Math.floor(this.refreshExpiry / 1000) },
    );
  }

  validateToken(token: string): JwtPayload {
    return this.jwtService.verify<JwtPayload>(token);
  }

  extractUsername(token: string): string {
    const payload = this.validateToken(token);
    return payload.sub;
  }

  extractRole(token: string): string {
    const payload = this.validateToken(token);
    return payload.role;
  }

  isTokenExpired(token: string): boolean {
    try {
      this.validateToken(token);
      return false;
    } catch {
      return true;
    }
  }

  isRefreshToken(token: string): boolean {
    try {
      const payload = this.jwtService.decode(token) as JwtPayload;
      return payload?.token_type === 'refresh';
    } catch {
      return false;
    }
  }
}

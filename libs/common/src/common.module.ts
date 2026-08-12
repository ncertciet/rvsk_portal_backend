import {
  Module,
  Global,
  MiddlewareConsumer,
  NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

import { GlobalExceptionFilter } from './exceptions';
import { JwtStrategy } from './security';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PageAccessGuard } from './guards/page-access.guard';
import { LoggingInterceptor } from './interceptors';
import { CorrelationIdMiddleware } from './middleware';
import { RedisModule } from './redis';

/**
 * Global CommonModule that wires up cross-cutting concerns:
 * - JWT authentication (Passport + JwtModule)
 * - Global exception filter (AppException → ErrorResponse)
 * - Global guards (JwtAuth, Roles, PageAccess)
 * - Global interceptor (Logging with correlation ID)
 * - Middleware (CorrelationIdMiddleware for all routes)
 * - Redis/cache layer
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256' as const },
      }),
    }),
    RedisModule.forRootAsync(),
  ],
  providers: [
    JwtStrategy,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PageAccessGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
  exports: [
    JwtModule,
    PassportModule,
    RedisModule,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

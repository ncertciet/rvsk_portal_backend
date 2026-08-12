// @rvsk/common barrel export
// Comprehensive barrel that allows:
// import { AppException, JwtAuthGuard, Roles, CurrentUser, PageResponse, CommonModule, ... } from '@rvsk/common'

// CommonModule (Global module wiring cross-cutting concerns)
export * from './common.module';

// Database (Oracle config, type transformers)
export * from './database';

// Exceptions (AppException, GlobalExceptionFilter, ErrorResponse)
export * from './exceptions';

// Security (JwtStrategy, JwtPayload, AuthenticatedUser interfaces)
export * from './security';

// Guards (JwtAuthGuard, RolesGuard, PageAccessGuard, ScopeEnforcerGuard)
export * from './guards';

// Decorators (Roles, CurrentUser, PageAccess, Public)
export * from './decorators';

// DTOs (PageResponse)
export * from './dto';

// Constants (RoleConstants)
export * from './constants';

// Redis (RedisModule, CacheService)
export * from './redis';

// Logger (createWinstonConfig)
export * from './logger';

// Interceptors (LoggingInterceptor)
export * from './interceptors';

// Middleware (CorrelationIdMiddleware)
export * from './middleware';

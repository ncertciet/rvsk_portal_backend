import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Accreditation-specific exception filter that handles database errors
 * and translates them into appropriate HTTP responses.
 *
 * Error mapping:
 * - Database unreachable (connection refused, timeout) → HTTP 503 Service Unavailable
 * - Materialized view not found ("relation does not exist") → HTTP 500 Internal Server Error (with logged stack trace)
 * - All other HttpExceptions → passed through with their original status
 * - Unknown errors → HTTP 500 Internal Server Error
 *
 * Note: Invalid academicYear format is handled by class-validator + ValidationPipe (returns 400 automatically).
 * Note: Non-existent stateCode returns empty data with status 'OK' (handled in service layer).
 *
 * Validates: Requirements 17.1, 17.2, 11.2
 */
@Catch()
export class AccreditationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AccreditationExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traceId =
      (request.headers['x-correlation-id'] as string) || uuidv4();
    const timestamp = new Date().toISOString();

    // If it's already an HttpException, let it pass through
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      this.logger.error(
        `[${traceId}] HTTP ${status}: ${exception.message}`,
        exception.stack,
      );

      response.status(status).json(
        typeof exceptionResponse === 'object'
          ? { ...exceptionResponse as object, traceId, timestamp }
          : {
              status,
              errorCode: 'HTTP_ERROR',
              message: exception.message,
              traceId,
              timestamp,
            },
      );
      return;
    }

    // Handle non-HTTP exceptions (database errors, etc.)
    const error = exception instanceof Error ? exception : new Error(String(exception));
    const errorMessage = error.message || '';

    // Check for database connection errors → 503 Service Unavailable
    if (this.isDatabaseConnectionError(errorMessage)) {
      this.logger.error(
        `[${traceId}] DATABASE_UNREACHABLE: ${errorMessage}`,
        error.stack,
      );

      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: HttpStatus.SERVICE_UNAVAILABLE,
        errorCode: 'DATABASE_UNREACHABLE',
        message: 'Service temporarily unavailable. Please try again later.',
        traceId,
        timestamp,
      });
      return;
    }

    // Check for materialized view not found → 500 Internal Server Error with logged stack trace
    if (this.isMaterializedViewError(errorMessage)) {
      this.logger.error(
        `[${traceId}] MV_NOT_FOUND: ${errorMessage}`,
        error.stack,
      );

      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: 'MV_NOT_FOUND',
        message: 'Internal server error. The required data source is unavailable.',
        traceId,
        timestamp,
      });
      return;
    }

    // Default: 500 Internal Server Error with logged stack trace
    this.logger.error(
      `[${traceId}] INTERNAL_ERROR: ${errorMessage}`,
      error.stack,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      traceId,
      timestamp,
    });
  }

  /**
   * Detects PostgreSQL connection errors including:
   * - Connection refused (ECONNREFUSED)
   * - Connection timeout
   * - Connection terminated unexpectedly
   * - Too many connections
   * - Host not found
   */
  private isDatabaseConnectionError(message: string): boolean {
    const connectionErrorPatterns = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EHOSTUNREACH',
      'connection refused',
      'connect ECONNREFUSED',
      'Connection terminated unexpectedly',
      'Connection terminated',
      'too many connections',
      'the database system is starting up',
      'the database system is shutting down',
      'could not connect to server',
      'connection to server',
      'remaining connection slots are reserved',
      'Cannot create a new connection',
      'getaddrinfo',
    ];

    const lowerMessage = message.toLowerCase();
    return connectionErrorPatterns.some((pattern) =>
      lowerMessage.includes(pattern.toLowerCase()),
    );
  }

  /**
   * Detects PostgreSQL "relation does not exist" errors,
   * which occur when a materialized view hasn't been created yet.
   */
  private isMaterializedViewError(message: string): boolean {
    const mvErrorPatterns = [
      'relation',
      'does not exist',
      'mv_dash_',
      'materialized view',
    ];

    const lowerMessage = message.toLowerCase();

    // Primary check: PostgreSQL "relation ... does not exist" error
    if (
      lowerMessage.includes('relation') &&
      lowerMessage.includes('does not exist')
    ) {
      return true;
    }

    // Secondary check: explicit materialized view reference errors
    if (
      lowerMessage.includes('materialized view') &&
      lowerMessage.includes('does not exist')
    ) {
      return true;
    }

    return false;
  }
}

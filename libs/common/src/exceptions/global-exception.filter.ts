import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppException } from './app.exception';
import { ErrorResponse } from './error-response.interface';
import { ERROR_CATALOG } from './error-catalog';

/**
 * Global exception filter — converts any thrown error into the standard
 * ErrorResponse envelope: { status, errorCode, message, traceId, timestamp }.
 *
 * Key behaviours:
 *  - AppException → uses its catalog code + user-facing message.
 *  - ValidationPipe (BadRequestException) → VALIDATION_FAILED with field messages.
 *  - Other HttpException → errorCode derived from HTTP status (NOT_FOUND, FORBIDDEN, ...).
 *  - Unknown/500 errors → generic INTERNAL_ERROR message to the client;
 *    the REAL error detail + stack are logged server-side, keyed by traceId.
 *    (Security: never leak SQL/ORA/stack traces to the client.)
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  /** Map an HTTP status to a coarse, machine-readable errorCode. */
  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST: return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED: return 'AUTH_UNAUTHORIZED';
      case HttpStatus.FORBIDDEN: return 'AUTH_FORBIDDEN';
      case HttpStatus.NOT_FOUND: return 'NOT_FOUND';
      case HttpStatus.CONFLICT: return 'CONFLICT';
      case HttpStatus.SERVICE_UNAVAILABLE: return 'DATABASE_UNREACHABLE';
      default: return 'INTERNAL_ERROR';
    }
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traceId =
      (request.headers['x-correlation-id'] as string) || uuidv4();
    const timestamp = new Date().toISOString();

    let errorResponse: ErrorResponse;
    // Extra detail to log server-side (never returned to the client).
    let internalLogDetail: string | undefined;

    if (exception instanceof AppException) {
      errorResponse = {
        status: exception.httpStatus,
        errorCode: exception.errorCode,
        message: exception.errorMessage,
        traceId,
        timestamp,
      };
      internalLogDetail = exception.internalDetail;
    } else if (exception instanceof BadRequestException) {
      // Validation errors from ValidationPipe — safe to surface field messages.
      const exceptionResponse = exception.getResponse() as any;
      if (exceptionResponse && typeof exceptionResponse === 'object' && exceptionResponse.message) {
        const validationMessage = Array.isArray(exceptionResponse.message)
          ? exceptionResponse.message.join('; ')
          : exceptionResponse.message;
        errorResponse = {
          status: HttpStatus.BAD_REQUEST,
          errorCode: 'VALIDATION_FAILED',
          message: validationMessage,
          traceId,
          timestamp,
        };
      } else {
        errorResponse = {
          status: HttpStatus.BAD_REQUEST,
          errorCode: 'BAD_REQUEST',
          message: ERROR_CATALOG.BAD_REQUEST.message,
          traceId,
          timestamp,
        };
      }
    } else if (exception instanceof HttpException) {
      // Built-in Nest exceptions (NotFound/Forbidden/Unauthorized/etc.)
      const status = exception.getStatus();
      const errorCode = this.codeForStatus(status);
      // For 4xx we can surface the framework message; for 5xx use a generic one.
      const isServerError = status >= 500;
      errorResponse = {
        status,
        errorCode,
        message: isServerError
          ? ERROR_CATALOG.INTERNAL_ERROR.message
          : exception.message,
        traceId,
        timestamp,
      };
      if (isServerError) internalLogDetail = exception.message;
    } else {
      // Unknown/unhandled error → generic message to client, real detail to logs.
      const errorMsg = exception instanceof Error ? exception.message : String(exception);
      errorResponse = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: 'INTERNAL_ERROR',
        message: ERROR_CATALOG.INTERNAL_ERROR.message,
        traceId,
        timestamp,
      };
      internalLogDetail = errorMsg;
    }

    // Server-side log carries the full picture, keyed by traceId for support.
    const logLine = `[${traceId}] ${errorResponse.errorCode} (${errorResponse.status})` +
      (internalLogDetail ? `: ${internalLogDetail}` : `: ${errorResponse.message}`);
    if (errorResponse.status >= 500) {
      this.logger.error(logLine, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(logLine);
    }

    response.status(errorResponse.status).json(errorResponse);
  }
}

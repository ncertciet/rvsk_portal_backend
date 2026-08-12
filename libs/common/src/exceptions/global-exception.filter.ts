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

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traceId =
      (request.headers['x-correlation-id'] as string) || uuidv4();
    const timestamp = new Date().toISOString();

    let errorResponse: ErrorResponse;

    if (exception instanceof AppException) {
      errorResponse = {
        status: exception.httpStatus,
        errorCode: exception.errorCode,
        message: exception.errorMessage,
        traceId,
        timestamp,
      };
    } else if (exception instanceof BadRequestException) {
      const exceptionResponse = exception.getResponse() as any;

      // Handle validation errors from ValidationPipe
      if (
        exceptionResponse &&
        typeof exceptionResponse === 'object' &&
        exceptionResponse.message
      ) {
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
          errorCode: 'INTERNAL_ERROR',
          message: exception.message,
          traceId,
          timestamp,
        };
      }
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      errorResponse = {
        status,
        errorCode: 'INTERNAL_ERROR',
        message: exception.message,
        traceId,
        timestamp,
      };
    } else {
      // Include actual error message for debugging (Oracle errors, etc.)
      const errorMsg = exception instanceof Error ? exception.message : String(exception);
      errorResponse = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode: 'INTERNAL_ERROR',
        message: errorMsg || 'An unexpected error occurred',
        traceId,
        timestamp,
      };
    }

    this.logger.error(
      `[${traceId}] ${errorResponse.errorCode}: ${errorResponse.message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(errorResponse.status).json(errorResponse);
  }
}

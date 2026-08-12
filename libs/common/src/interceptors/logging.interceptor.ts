import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

const SLOW_REQUEST_THRESHOLD_MS = 3000;

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url } = request;
    const correlationId = request.headers['x-correlation-id'] as string;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const elapsed = Date.now() - startTime;
          const statusCode = response.statusCode;
          const message = `${method} ${url} ${statusCode} - ${elapsed}ms`;
          const logMeta = correlationId ? ` [${correlationId}]` : '';

          if (elapsed > SLOW_REQUEST_THRESHOLD_MS) {
            this.logger.warn(`[SLOW]${logMeta} ${message}`);
          } else {
            this.logger.log(`${logMeta} ${message}`);
          }
        },
        error: (error) => {
          const elapsed = Date.now() - startTime;
          const statusCode = error?.status || error?.statusCode || 500;
          const message = `${method} ${url} ${statusCode} - ${elapsed}ms`;
          const logMeta = correlationId ? ` [${correlationId}]` : '';

          this.logger.error(`${logMeta} ${message}`);
        },
      }),
    );
  }
}

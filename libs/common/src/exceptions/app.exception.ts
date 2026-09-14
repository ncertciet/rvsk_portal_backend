import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, getCatalogEntry } from './error-catalog';

/**
 * Domain exception carrying a standardized error code.
 *
 * Two ways to construct it:
 *
 * 1. Code-first (preferred) — status + user-facing message come from the catalog:
 *      throw new AppException('USER_NOT_FOUND');
 *      throw new AppException('ACCR_NO_DATA', 'no rows for 2026-27'); // 2nd arg = internal detail (logged, not shown)
 *
 * 2. Legacy (still supported) — explicit message, status, code:
 *      throw new AppException('User not found', HttpStatus.NOT_FOUND, 'USER_NOT_FOUND');
 *
 * The response body (built by GlobalExceptionFilter) always contains:
 *   { status, errorCode, message, traceId, timestamp }
 * where `message` is the user-facing catalog message.
 */
export class AppException extends HttpException {
  public readonly errorCode: string;
  public readonly httpStatus: HttpStatus;
  public readonly errorMessage: string;
  /** Optional internal detail — logged server-side, never sent to the client. */
  public readonly internalDetail?: string;

  // Code-first overload
  constructor(code: ErrorCode, internalDetail?: string);
  // Legacy overload
  constructor(errorMessage: string, httpStatus: HttpStatus, errorCode: string);
  constructor(
    codeOrMessage: ErrorCode | string,
    detailOrStatus?: string | HttpStatus,
    legacyCode?: string,
  ) {
    // Legacy signature: (message, status:number, code)
    if (typeof detailOrStatus === 'number' && typeof legacyCode === 'string') {
      const message = codeOrMessage as string;
      const status = detailOrStatus as HttpStatus;
      super({ status, errorCode: legacyCode, message }, status);
      this.errorCode = legacyCode;
      this.httpStatus = status;
      this.errorMessage = message;
      return;
    }

    // Code-first signature: (code, internalDetail?)
    const code = codeOrMessage as ErrorCode;
    const entry = getCatalogEntry(code);
    super({ status: entry.status, errorCode: code, message: entry.message }, entry.status);
    this.errorCode = code;
    this.httpStatus = entry.status;
    this.errorMessage = entry.message;
    this.internalDetail = typeof detailOrStatus === 'string' ? detailOrStatus : undefined;
  }
}

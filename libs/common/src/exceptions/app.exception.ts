import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    public readonly errorMessage: string,
    public readonly httpStatus: HttpStatus,
    public readonly errorCode: string,
  ) {
    super(
      { status: httpStatus, errorCode, message: errorMessage },
      httpStatus,
    );
  }
}

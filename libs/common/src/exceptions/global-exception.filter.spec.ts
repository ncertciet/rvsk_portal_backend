import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ErrorResponse } from './error-response.interface';
import { AppException } from './app.exception';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      headers: {},
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should handle AppException with its httpStatus, errorCode, and errorMessage', () => {
    const exception = new AppException(
      'User not found',
      HttpStatus.NOT_FOUND,
      'USER_NOT_FOUND',
    );

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const responseBody: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(responseBody.status).toBe(HttpStatus.NOT_FOUND);
    expect(responseBody.errorCode).toBe('USER_NOT_FOUND');
    expect(responseBody.message).toBe('User not found');
    expect(responseBody.traceId).toBeDefined();
    expect(responseBody.timestamp).toBeDefined();
  });

  it('should handle HttpException with INTERNAL_ERROR errorCode', () => {
    const exception = new HttpException('Forbidden resource', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    const responseBody: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(responseBody.status).toBe(HttpStatus.FORBIDDEN);
    expect(responseBody.errorCode).toBe('INTERNAL_ERROR');
    expect(responseBody.message).toBe('Forbidden resource');
  });

  it('should handle unknown exceptions with 500 and generic message', () => {
    const exception = new Error('Something went wrong');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const responseBody: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(responseBody.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseBody.errorCode).toBe('INTERNAL_ERROR');
    expect(responseBody.message).toBe('An unexpected error occurred');
  });

  it('should use x-correlation-id header as traceId when present', () => {
    const correlationId = '550e8400-e29b-41d4-a716-446655440000';
    mockRequest.headers['x-correlation-id'] = correlationId;

    const exception = new Error('test');
    filter.catch(exception, mockHost as any);

    const responseBody: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(responseBody.traceId).toBe(correlationId);
  });

  it('should generate UUID v4 as traceId when no correlation header is present', () => {
    const exception = new Error('test');
    filter.catch(exception, mockHost as any);

    const responseBody: ErrorResponse = mockResponse.json.mock.calls[0][0];
    // UUID v4 format: 8-4-4-4-12 hex chars
    expect(responseBody.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('should return ISO 8601 timestamp', () => {
    const exception = new Error('test');
    filter.catch(exception, mockHost as any);

    const responseBody: ErrorResponse = mockResponse.json.mock.calls[0][0];
    // Verify it's a valid ISO 8601 string
    const parsedDate = new Date(responseBody.timestamp);
    expect(parsedDate.toISOString()).toBe(responseBody.timestamp);
  });

  it('should handle validation errors from ValidationPipe (array of messages)', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['username must not be empty', 'password must be at least 6 characters'],
      error: 'Bad Request',
    });

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const responseBody: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(responseBody.status).toBe(HttpStatus.BAD_REQUEST);
    expect(responseBody.errorCode).toBe('VALIDATION_FAILED');
    expect(responseBody.message).toBe(
      'username must not be empty; password must be at least 6 characters',
    );
  });

  it('should handle validation errors from ValidationPipe (string message)', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      error: 'Bad Request',
    });

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const responseBody: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(responseBody.status).toBe(HttpStatus.BAD_REQUEST);
    expect(responseBody.errorCode).toBe('VALIDATION_FAILED');
    expect(responseBody.message).toBe('Validation failed');
  });
});

describe('AppException', () => {
  it('should extend HttpException', () => {
    const exception = new AppException(
      'Test error',
      HttpStatus.BAD_REQUEST,
      'TEST_ERROR',
    );
    expect(exception).toBeInstanceOf(HttpException);
  });

  it('should expose errorMessage, httpStatus, and errorCode', () => {
    const exception = new AppException(
      'Account is locked',
      423 as HttpStatus,
      'ACCOUNT_LOCKED',
    );
    expect(exception.errorMessage).toBe('Account is locked');
    expect(exception.httpStatus).toBe(423);
    expect(exception.errorCode).toBe('ACCOUNT_LOCKED');
  });

  it('should set the HTTP status code correctly', () => {
    const exception = new AppException(
      'Not found',
      HttpStatus.NOT_FOUND,
      'NOT_FOUND',
    );
    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('should produce the correct response body', () => {
    const exception = new AppException(
      'Auth failed',
      HttpStatus.UNAUTHORIZED,
      'AUTH_FAILED',
    );
    const response = exception.getResponse() as any;
    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(response.errorCode).toBe('AUTH_FAILED');
    expect(response.message).toBe('Auth failed');
  });
});

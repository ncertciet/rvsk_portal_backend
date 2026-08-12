import * as fc from 'fast-check';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { AppException } from './app.exception';

/**
 * Property 8: Error Response Shape Invariance
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.5**
 */
describe('Property: Error Response Shape Invariance (Property 8)', () => {

  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let capturedBody: any;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    capturedBody = null;
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn((body) => { capturedBody = body; }),
    };
    mockRequest = { headers: {} };
  });

  function createHost(request?: any) {
    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => request || mockRequest,
      }),
    } as any;
  }

  it('ANY exception always produces response with exactly 5 fields: status, errorCode, message, traceId, timestamp', () => {
    const exceptions = [
      new AppException('test', HttpStatus.BAD_REQUEST, 'TEST_ERROR'),
      new HttpException('http error', 403),
      new BadRequestException('validation'),
      new Error('generic'),
      'string error',
      null,
      undefined,
    ];

    for (const exception of exceptions) {
      capturedBody = null;
      filter.catch(exception, createHost());
      
      expect(capturedBody).toHaveProperty('status');
      expect(capturedBody).toHaveProperty('errorCode');
      expect(capturedBody).toHaveProperty('message');
      expect(capturedBody).toHaveProperty('traceId');
      expect(capturedBody).toHaveProperty('timestamp');
      expect(typeof capturedBody.status).toBe('number');
      expect(typeof capturedBody.errorCode).toBe('string');
      expect(typeof capturedBody.message).toBe('string');
      expect(typeof capturedBody.traceId).toBe('string');
      expect(typeof capturedBody.timestamp).toBe('string');
    }
  });

  it('AppException values propagate correctly to response', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 100 }),
      fc.constantFrom(400, 401, 403, 404, 409, 422, 500),
      fc.string({ minLength: 1, maxLength: 30 }),
      (message, status, errorCode) => {
        capturedBody = null;
        const exception = new AppException(message, status as HttpStatus, errorCode);
        filter.catch(exception, createHost());
        return capturedBody.status === status &&
               capturedBody.errorCode === errorCode &&
               capturedBody.message === message;
      }
    ));
  });

  it('x-correlation-id header is used as traceId when present', () => {
    fc.assert(fc.property(
      fc.uuid(),
      (correlationId) => {
        capturedBody = null;
        const request = { headers: { 'x-correlation-id': correlationId } };
        filter.catch(new Error('test'), createHost(request));
        return capturedBody.traceId === correlationId;
      }
    ));
  });

  it('traceId is a valid UUID when no correlation header', () => {
    capturedBody = null;
    filter.catch(new Error('test'), createHost());
    // UUID v4 format: 8-4-4-4-12 hex chars
    expect(capturedBody.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('timestamp is a valid ISO 8601 string', () => {
    capturedBody = null;
    filter.catch(new Error('test'), createHost());
    const date = new Date(capturedBody.timestamp);
    expect(date.toISOString()).toBe(capturedBody.timestamp);
  });
});

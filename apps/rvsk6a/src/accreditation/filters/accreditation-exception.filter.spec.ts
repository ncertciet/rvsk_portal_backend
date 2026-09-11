import { HttpStatus, HttpException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AccreditationExceptionFilter } from './accreditation-exception.filter';

describe('AccreditationExceptionFilter', () => {
  let filter: AccreditationExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;
  let capturedStatus: number;
  let capturedBody: any;

  beforeEach(() => {
    filter = new AccreditationExceptionFilter();
    capturedStatus = 0;
    capturedBody = null;

    mockResponse = {
      status: jest.fn().mockImplementation((status: number) => {
        capturedStatus = status;
        return mockResponse;
      }),
      json: jest.fn().mockImplementation((body: any) => {
        capturedBody = body;
      }),
    };

    mockRequest = {
      headers: { 'x-correlation-id': 'test-trace-id' },
      url: '/api/v1/accreditation/dashboard/coverage-reach',
      method: 'GET',
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  describe('Database unreachable → HTTP 503', () => {
    it('should return 503 for ECONNREFUSED errors', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:5432');

      filter.catch(error, mockHost);

      expect(capturedStatus).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(capturedBody.errorCode).toBe('DATABASE_UNREACHABLE');
      expect(capturedBody.traceId).toBe('test-trace-id');
    });

    it('should return 503 for connection timeout errors', () => {
      const error = new Error('Connection terminated unexpectedly');

      filter.catch(error, mockHost);

      expect(capturedStatus).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(capturedBody.errorCode).toBe('DATABASE_UNREACHABLE');
    });

    it('should return 503 for ETIMEDOUT errors', () => {
      const error = new Error('connect ETIMEDOUT 10.0.0.1:5432');

      filter.catch(error, mockHost);

      expect(capturedStatus).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(capturedBody.errorCode).toBe('DATABASE_UNREACHABLE');
    });

    it('should return 503 for too many connections errors', () => {
      const error = new Error('too many connections for role "rvsk"');

      filter.catch(error, mockHost);

      expect(capturedStatus).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(capturedBody.errorCode).toBe('DATABASE_UNREACHABLE');
    });

    it('should return 503 for database starting up errors', () => {
      const error = new Error('the database system is starting up');

      filter.catch(error, mockHost);

      expect(capturedStatus).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(capturedBody.errorCode).toBe('DATABASE_UNREACHABLE');
    });
  });

  describe('Materialized view not found → HTTP 500', () => {
    it('should return 500 for "relation does not exist" errors', () => {
      const error = new Error(
        'relation "accreditation.mv_dash_coverage_reach" does not exist',
      );

      filter.catch(error, mockHost);

      expect(capturedStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(capturedBody.errorCode).toBe('MV_NOT_FOUND');
      expect(capturedBody.traceId).toBe('test-trace-id');
    });

    it('should return 500 for materialized view does not exist errors', () => {
      const error = new Error(
        'materialized view "mv_dash_programme_framework" does not exist',
      );

      filter.catch(error, mockHost);

      expect(capturedStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(capturedBody.errorCode).toBe('MV_NOT_FOUND');
    });
  });

  describe('HttpException passthrough', () => {
    it('should pass through NotFoundException with 404 status', () => {
      const exception = new NotFoundException('KPI 18 is not available');

      filter.catch(exception, mockHost);

      expect(capturedStatus).toBe(HttpStatus.NOT_FOUND);
    });

    it('should pass through BadRequestException with 400 status', () => {
      const exception = new BadRequestException('Invalid KPI number');

      filter.catch(exception, mockHost);

      expect(capturedStatus).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should pass through generic HttpException with its status', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      expect(capturedStatus).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('Unknown errors → HTTP 500', () => {
    it('should return 500 for generic unrecognized errors', () => {
      const error = new Error('Something went terribly wrong');

      filter.catch(error, mockHost);

      expect(capturedStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(capturedBody.errorCode).toBe('INTERNAL_ERROR');
      expect(capturedBody.traceId).toBe('test-trace-id');
    });

    it('should handle non-Error exceptions gracefully', () => {
      filter.catch('string error', mockHost);

      expect(capturedStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(capturedBody.errorCode).toBe('INTERNAL_ERROR');
    });
  });

  describe('Response structure', () => {
    it('should always include traceId and timestamp', () => {
      const error = new Error('any error');

      filter.catch(error, mockHost);

      expect(capturedBody.traceId).toBe('test-trace-id');
      expect(capturedBody.timestamp).toBeDefined();
      expect(new Date(capturedBody.timestamp).toISOString()).toBe(capturedBody.timestamp);
    });

    it('should generate traceId if x-correlation-id header is missing', () => {
      mockRequest.headers = {};
      const error = new Error('connect ECONNREFUSED 127.0.0.1:5432');

      filter.catch(error, mockHost);

      expect(capturedBody.traceId).toBeDefined();
      expect(capturedBody.traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });
});

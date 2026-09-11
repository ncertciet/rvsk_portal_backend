import { AccreditationService } from './accreditation.service';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * Unit tests for AccreditationService.refreshViews()
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.5
 */
describe('AccreditationService - refreshViews()', () => {
  let service: AccreditationService;
  let mockDataSource: jest.Mocked<Pick<DataSource, 'query'>>;

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn(),
    };

    // ConfigService stub returning the ADW schema for ACCR_SCHEMA.
    const mockConfig = {
      get: jest.fn((_key: string, def?: string) => def ?? 'RTIWARI'),
    } as unknown as ConfigService;

    // Create service instance with mocked Oracle DataSource + config
    service = new AccreditationService(
      mockDataSource as unknown as DataSource,
      mockConfig,
    );
  });

  describe('Watermark check — new data available (Req 10.1, 10.2, 10.5)', () => {
    it('should refresh when max_load_ts is newer than last_refresh', async () => {
      const loadTs = '2025-06-15T10:00:00.000Z';
      const lastRefresh = '2025-06-14T08:00:00.000Z';

      mockDataSource.query
        .mockResolvedValueOnce([{ max_load_ts: loadTs }]) // MAX(dw_load_ts)
        .mockResolvedValueOnce([{ last_refresh: lastRefresh }]) // pg_stat last refresh
        .mockResolvedValueOnce([]); // refresh_dashboard_views() call

      const result = await service.refreshViews();

      expect(result.refreshed).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp!).getTime()).not.toBeNaN();
      expect(result.reason).toBeUndefined();
    });

    it('should refresh when last_refresh is null (never refreshed)', async () => {
      const loadTs = '2025-06-15T10:00:00.000Z';

      mockDataSource.query
        .mockResolvedValueOnce([{ max_load_ts: loadTs }])
        .mockResolvedValueOnce([{ last_refresh: null }])
        .mockResolvedValueOnce([]);

      const result = await service.refreshViews();

      expect(result.refreshed).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    it('should call refresh_dashboard_views() when new data exists', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ max_load_ts: '2025-06-15T10:00:00.000Z' }])
        .mockResolvedValueOnce([{ last_refresh: '2025-06-14T08:00:00.000Z' }])
        .mockResolvedValueOnce([]);

      await service.refreshViews();

      // Verify the three queries were called in order (Oracle):
      // 1. MAX(dw_load_ts)
      // 2. all_mviews last_refresh_date watermark
      // 3. refresh_dashboard_views() via PL/SQL block
      expect(mockDataSource.query).toHaveBeenCalledTimes(3);
      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('MAX(dw_load_ts)'),
      );
      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('all_mviews'),
        expect.anything(),
      );
      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('refresh_dashboard_views'),
      );
    });

    it('should return an ISO 8601 timestamp when refreshed', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ max_load_ts: '2025-06-15T10:00:00.000Z' }])
        .mockResolvedValueOnce([{ last_refresh: null }])
        .mockResolvedValueOnce([]);

      const result = await service.refreshViews();

      // Verify timestamp is a valid ISO 8601 string
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(result.timestamp).toMatch(isoRegex);
    });
  });

  describe('Watermark check — no new data (Req 10.3)', () => {
    it('should not refresh when max_load_ts equals last_refresh', async () => {
      const sameTimestamp = '2025-06-15T10:00:00.000Z';

      mockDataSource.query
        .mockResolvedValueOnce([{ max_load_ts: sameTimestamp }])
        .mockResolvedValueOnce([{ last_refresh: sameTimestamp }]);

      const result = await service.refreshViews();

      expect(result.refreshed).toBe(false);
      expect(result.reason).toBe('No new ETL data since last refresh');
      expect(result.timestamp).toBeUndefined();
      // Should NOT call refresh_dashboard_views
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });

    it('should not refresh when max_load_ts is older than last_refresh', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ max_load_ts: '2025-06-14T08:00:00.000Z' }])
        .mockResolvedValueOnce([{ last_refresh: '2025-06-15T10:00:00.000Z' }]);

      const result = await service.refreshViews();

      expect(result.refreshed).toBe(false);
      expect(result.reason).toBe('No new ETL data since last refresh');
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });

    it('should not refresh when max_load_ts is null (empty fact table)', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ max_load_ts: null }])
        .mockResolvedValueOnce([{ last_refresh: '2025-06-15T10:00:00.000Z' }]);

      const result = await service.refreshViews();

      expect(result.refreshed).toBe(false);
      expect(result.reason).toBe('No new ETL data since last refresh');
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });

    it('should not acquire locks when no new data exists', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ max_load_ts: '2025-06-14T08:00:00.000Z' }])
        .mockResolvedValueOnce([{ last_refresh: '2025-06-15T10:00:00.000Z' }]);

      await service.refreshViews();

      // Only 2 queries (watermark checks), no refresh call
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
      // Ensure refresh_dashboard_views was never called
      const calls = mockDataSource.query.mock.calls.map((c) => c[0]);
      expect(calls.some((q: string) => q.includes('refresh_dashboard_views'))).toBe(false);
    });
  });

  describe('Return value structure', () => {
    it('should return { refreshed: true, timestamp } when refreshed', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ max_load_ts: '2025-06-15T10:00:00.000Z' }])
        .mockResolvedValueOnce([{ last_refresh: null }])
        .mockResolvedValueOnce([]);

      const result = await service.refreshViews();

      expect(result).toHaveProperty('refreshed', true);
      expect(result).toHaveProperty('timestamp');
      expect(result).not.toHaveProperty('reason');
    });

    it('should return { refreshed: false, reason } when not refreshed', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ max_load_ts: null }])
        .mockResolvedValueOnce([{ last_refresh: null }]);

      const result = await service.refreshViews();

      expect(result).toHaveProperty('refreshed', false);
      expect(result).toHaveProperty('reason', 'No new ETL data since last refresh');
      expect(result).not.toHaveProperty('timestamp');
    });
  });
});

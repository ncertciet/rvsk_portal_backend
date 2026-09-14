import { AppException } from '@rvsk/common';
import { AccreditationService } from './accreditation.service';

/**
 * Unit tests for AccreditationService.getKpiByNumber()
 *
 * Validates: Requirements 9.1, 9.2, 9.3
 */
describe('AccreditationService - getKpiByNumber()', () => {
  let service: AccreditationService;

  // Mock section handler responses
  const mockProgrammeFrameworkResponse = {
    kpi_no: [1, 2, 3],
    title: 'Programme Infrastructure & Framework',
    as_of: '2025-01-01T00:00:00.000Z',
    filters: { stateCode: 'ALL', academicYear: '2025-26' },
    data: {
      kpi_1: { states_with_programme: 28, total_states: 36 },
      kpi_2: { states_with_authority: 15, authorities: [] },
      kpi_3: { models: [] },
    },
    status: 'OK' as const,
  };

  const mockCoverageReachResponse = {
    kpi_no: [4, 5, 6],
    title: 'Coverage & Reach',
    as_of: '2025-01-01T00:00:00.000Z',
    filters: { stateCode: 'ALL', academicYear: '2025-26' },
    data: {
      kpi_4: { total_schools_accredited: 5000, by_state: [] },
      kpi_5: { round_distribution: { round_1: 3000, round_2: 1500, round_3_plus: 500 }, avg_rounds: 1.4 },
      kpi_6: { national_coverage_pct: 45.2, by_state: [] },
    },
    status: 'OK' as const,
  };

  const mockProcessOperationsResponse = {
    kpi_no: [7, 8, 9, 10],
    title: 'Process Quality & Operations',
    as_of: '2025-01-01T00:00:00.000Z',
    filters: { stateCode: 'ALL', academicYear: '2025-26' },
    data: {
      kpi_7: { frequency_distribution: [] },
      kpi_8: { visit_coverage_pct: 72.5, visited_schools: 3625, total_accredited: 5000 },
      kpi_9: { authority_participation: { state_official: 80, district_official: 60, block_official: 40, cluster_official: 30, community_members: 20, third_party_auditors: 10 } },
      kpi_10: { states_with_vsk: 12, states: [] },
    },
    status: 'OK' as const,
  };

  const mockDomainComponentsResponse = {
    kpi_no: [11, 12],
    title: 'Domain Components',
    as_of: '2025-01-01T00:00:00.000Z',
    filters: { stateCode: 'ALL', academicYear: '2025-26' },
    data: {
      kpi_11: { domains_assessed: [] },
      kpi_12: { domain_scores: [] },
    },
    status: 'OK' as const,
  };

  const mockDataQualityResponse = {
    kpi_no: [13, 14],
    title: 'Data Quality & Compliance',
    as_of: '2025-01-01T00:00:00.000Z',
    filters: { stateCode: 'ALL', academicYear: '2025-26' },
    data: {
      kpi_13: { self_disclosure_pct: 85.5, schools_submitted: 4275, total_schools: 5000 },
      kpi_14: { on_time_pct: 70.0, delayed_pct: 20.0, significantly_delayed_pct: 10.0, avg_delay_days: 5.2 },
    },
    status: 'OK' as const,
  };

  const mockImpactOutcomesResponse = {
    kpi_no: [15, 16, 17],
    title: 'Impact/Outcomes & Decision-Making',
    as_of: '2025-01-01T00:00:00.000Z',
    filters: { stateCode: 'ALL', academicYear: '2025-26' },
    data: {
      kpi_15: { decision_use_cases: {} },
      kpi_16: { pct_schools_improved: 65.0, schools_improved: 1300, schools_with_prior: 2000, avg_score_change: 8.5 },
      kpi_17: { sharing_distribution: [] },
    },
    status: 'OK' as const,
  };

  beforeEach(() => {
    // Create a partial mock of the service
    service = Object.create(AccreditationService.prototype);

    // Mock all section handler methods
    service.getProgrammeFramework = jest.fn().mockResolvedValue(mockProgrammeFrameworkResponse);
    service.getCoverageReach = jest.fn().mockResolvedValue(mockCoverageReachResponse);
    service.getProcessOperations = jest.fn().mockResolvedValue(mockProcessOperationsResponse);
    service.getDomainComponents = jest.fn().mockResolvedValue(mockDomainComponentsResponse);
    service.getDataQuality = jest.fn().mockResolvedValue(mockDataQualityResponse);
    service.getImpactOutcomes = jest.fn().mockResolvedValue(mockImpactOutcomesResponse);
  });

  describe('Valid KPI routing (1–17)', () => {
    it('should route KPI 1 to getProgrammeFramework and return kpi_1 data', async () => {
      const result = await service.getKpiByNumber(1, { stateCode: 'ALL' });
      expect(service.getProgrammeFramework).toHaveBeenCalledWith({ stateCode: 'ALL' });
      expect(result.kpi_no).toBe(1);
      expect(result.data).toEqual({ states_with_programme: 28, total_states: 36 });
      expect(result.status).toBe('OK');
    });

    it('should route KPI 2 to getProgrammeFramework and return kpi_2 data', async () => {
      const result = await service.getKpiByNumber(2, { stateCode: 'ALL' });
      expect(result.kpi_no).toBe(2);
      expect(result.data).toEqual({ states_with_authority: 15, authorities: [] });
    });

    it('should route KPI 3 to getProgrammeFramework and return kpi_3 data', async () => {
      const result = await service.getKpiByNumber(3, { stateCode: 'ALL' });
      expect(result.kpi_no).toBe(3);
      expect(result.data).toEqual({ models: [] });
    });

    it('should route KPI 4 to getCoverageReach and return kpi_4 data', async () => {
      const result = await service.getKpiByNumber(4, { stateCode: 'ALL' });
      expect(service.getCoverageReach).toHaveBeenCalledWith({ stateCode: 'ALL' });
      expect(result.kpi_no).toBe(4);
      expect(result.data).toEqual({ total_schools_accredited: 5000, by_state: [] });
    });

    it('should route KPI 5 to getCoverageReach and return kpi_5 data', async () => {
      const result = await service.getKpiByNumber(5, { stateCode: 'ALL' });
      expect(result.kpi_no).toBe(5);
      expect(result.data).toEqual({
        round_distribution: { round_1: 3000, round_2: 1500, round_3_plus: 500 },
        avg_rounds: 1.4,
      });
    });

    it('should route KPI 6 to getCoverageReach and return kpi_6 data', async () => {
      const result = await service.getKpiByNumber(6, { stateCode: 'ALL' });
      expect(result.kpi_no).toBe(6);
      expect(result.data).toEqual({ national_coverage_pct: 45.2, by_state: [] });
    });

    it('should route KPI 7 to getProcessOperations and return kpi_7 data', async () => {
      const result = await service.getKpiByNumber(7, { stateCode: 'ALL' });
      expect(service.getProcessOperations).toHaveBeenCalledWith({ stateCode: 'ALL' });
      expect(result.kpi_no).toBe(7);
      expect(result.data).toEqual({ frequency_distribution: [] });
    });

    it('should route KPI 8 to getProcessOperations and return kpi_8 data', async () => {
      const result = await service.getKpiByNumber(8, { stateCode: 'ALL' });
      expect(result.kpi_no).toBe(8);
      expect(result.data).toEqual({ visit_coverage_pct: 72.5, visited_schools: 3625, total_accredited: 5000 });
    });

    it('should route KPI 9 to getProcessOperations and return kpi_9 data', async () => {
      const result = await service.getKpiByNumber(9, { stateCode: 'ALL' });
      expect(result.kpi_no).toBe(9);
      expect(result.data.authority_participation).toBeDefined();
    });

    it('should route KPI 10 to getProcessOperations and return kpi_10 data', async () => {
      const result = await service.getKpiByNumber(10, { stateCode: 'ALL' });
      expect(result.kpi_no).toBe(10);
      expect(result.data).toEqual({ states_with_vsk: 12, states: [] });
    });

    it('should route KPI 11 to getDomainComponents and return kpi_11 data', async () => {
      const result = await service.getKpiByNumber(11, { stateCode: 'ALL' });
      expect(service.getDomainComponents).toHaveBeenCalledWith({ stateCode: 'ALL' });
      expect(result.kpi_no).toBe(11);
      expect(result.data).toEqual({ domains_assessed: [] });
    });

    it('should route KPI 12 to getDomainComponents and return kpi_12 data', async () => {
      const result = await service.getKpiByNumber(12, { stateCode: 'ALL' });
      expect(result.kpi_no).toBe(12);
      expect(result.data).toEqual({ domain_scores: [] });
    });

    it('should route KPI 13 to getDataQuality and return kpi_13 data', async () => {
      const result = await service.getKpiByNumber(13, { stateCode: 'ALL' });
      expect(service.getDataQuality).toHaveBeenCalledWith({ stateCode: 'ALL' });
      expect(result.kpi_no).toBe(13);
      expect(result.data).toEqual({ self_disclosure_pct: 85.5, schools_submitted: 4275, total_schools: 5000 });
    });

    it('should route KPI 14 to getDataQuality and return kpi_14 data', async () => {
      const result = await service.getKpiByNumber(14, { stateCode: 'ALL' });
      expect(result.kpi_no).toBe(14);
      expect(result.data).toEqual({ on_time_pct: 70.0, delayed_pct: 20.0, significantly_delayed_pct: 10.0, avg_delay_days: 5.2 });
    });

    it('should route KPI 15 to getImpactOutcomes and return kpi_15 data', async () => {
      const result = await service.getKpiByNumber(15, { stateCode: 'ALL' });
      expect(service.getImpactOutcomes).toHaveBeenCalledWith({ stateCode: 'ALL' });
      expect(result.kpi_no).toBe(15);
      expect(result.data).toEqual({ decision_use_cases: {} });
    });

    it('should route KPI 16 to getImpactOutcomes and return kpi_16 data', async () => {
      const result = await service.getKpiByNumber(16, { stateCode: 'ALL' });
      expect(result.kpi_no).toBe(16);
      expect(result.data).toEqual({
        pct_schools_improved: 65.0,
        schools_improved: 1300,
        schools_with_prior: 2000,
        avg_score_change: 8.5,
      });
    });

    it('should route KPI 17 to getImpactOutcomes and return kpi_17 data', async () => {
      const result = await service.getKpiByNumber(17, { stateCode: 'ALL' });
      expect(result.kpi_no).toBe(17);
      expect(result.data).toEqual({ sharing_distribution: [] });
    });
  });

  describe('KPI envelope structure', () => {
    it('should return a proper KPI envelope with single kpi_no (not array)', async () => {
      const result = await service.getKpiByNumber(1, { stateCode: 'ALL' });
      expect(result.kpi_no).toBe(1);
      expect(typeof result.kpi_no).toBe('number');
      expect(result.title).toBe('Programme Infrastructure & Framework');
      expect(result.as_of).toBeDefined();
      expect(result.filters).toBeDefined();
      expect(result.status).toBe('OK');
    });

    it('should pass filters through to the section handler', async () => {
      const filters = { stateCode: 'UP', academicYear: '2024-25' };
      await service.getKpiByNumber(4, filters);
      expect(service.getCoverageReach).toHaveBeenCalledWith(filters);
    });
  });

  describe('HTTP 404 for KPI 18/19/20', () => {
    it('should throw AppException (ACCR_KPI_NOT_AVAILABLE) for KPI 18', async () => {
      await expect(service.getKpiByNumber(18, { stateCode: 'ALL' })).rejects.toThrow(
        AppException,
      );
      await expect(service.getKpiByNumber(18, { stateCode: 'ALL' })).rejects.toMatchObject({
        errorCode: 'ACCR_KPI_NOT_AVAILABLE',
        httpStatus: 404,
      });
    });

    it('should throw AppException (ACCR_KPI_NOT_AVAILABLE) for KPI 19', async () => {
      await expect(service.getKpiByNumber(19, { stateCode: 'ALL' })).rejects.toThrow(
        AppException,
      );
      await expect(service.getKpiByNumber(19, { stateCode: 'ALL' })).rejects.toMatchObject({
        errorCode: 'ACCR_KPI_NOT_AVAILABLE',
        httpStatus: 404,
      });
    });

    it('should throw AppException (ACCR_KPI_NOT_AVAILABLE) for KPI 20', async () => {
      await expect(service.getKpiByNumber(20, { stateCode: 'ALL' })).rejects.toThrow(
        AppException,
      );
      await expect(service.getKpiByNumber(20, { stateCode: 'ALL' })).rejects.toMatchObject({
        errorCode: 'ACCR_KPI_NOT_AVAILABLE',
        httpStatus: 404,
      });
    });
  });

  describe('HTTP 400 for invalid input', () => {
    it('should throw AppException (ACCR_INVALID_KPI) for kpiNo = 0', async () => {
      await expect(service.getKpiByNumber(0, { stateCode: 'ALL' })).rejects.toThrow(AppException);
      await expect(service.getKpiByNumber(0, { stateCode: 'ALL' })).rejects.toMatchObject({
        errorCode: 'ACCR_INVALID_KPI',
        httpStatus: 400,
      });
    });

    it('should throw AppException (ACCR_INVALID_KPI) for negative kpiNo', async () => {
      await expect(service.getKpiByNumber(-1, { stateCode: 'ALL' })).rejects.toThrow(AppException);
    });

    it('should throw AppException (ACCR_INVALID_KPI) for kpiNo > 20', async () => {
      await expect(service.getKpiByNumber(21, { stateCode: 'ALL' })).rejects.toThrow(AppException);
    });

    it('should throw AppException (ACCR_INVALID_KPI) for non-integer kpiNo', async () => {
      await expect(service.getKpiByNumber(1.5, { stateCode: 'ALL' })).rejects.toThrow(AppException);
    });

    it('should throw AppException (ACCR_INVALID_KPI) for NaN', async () => {
      await expect(service.getKpiByNumber(NaN, { stateCode: 'ALL' })).rejects.toThrow(AppException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { MasterDataService } from './master-data.service';

/**
 * Unit tests for MasterDataService (RVSK-USR-MGMT-001.3).
 * The DataSource.query is mocked; we assert the SQL is parameterised, keys are
 * returned as strings, invalid keys short-circuit, and single-row lookups map
 * the parent chain correctly.
 */
describe('MasterDataService', () => {
  let service: MasterDataService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterDataService,
        { provide: getDataSourceToken(), useValue: { query } },
      ],
    }).compile();
    service = module.get(MasterDataService);
  });

  describe('getStates', () => {
    it('returns options with key as string and name', async () => {
      query.mockResolvedValueOnce([
        { state_key: 111, state_name: 'UTTAR PRADESH' },
        { state_key: 222, state_name: 'BIHAR' },
      ]);
      const result = await service.getStates();
      expect(result).toEqual([
        { key: '111', name: 'UTTAR PRADESH' },
        { key: '222', name: 'BIHAR' },
      ]);
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDistricts', () => {
    it('queries by stateKey and maps results', async () => {
      query.mockResolvedValueOnce([{ district_key: 999, district_name: 'MEERUT' }]);
      const result = await service.getDistricts('111');
      expect(result).toEqual([{ key: '999', name: 'MEERUT' }]);
      // Parameterised with the stateKey.
      expect(query.mock.calls[0][1]).toEqual(['111']);
    });

    it('short-circuits (no query) for a non-numeric key', async () => {
      const result = await service.getDistricts('abc');
      expect(result).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('short-circuits for empty key', async () => {
      const result = await service.getDistricts('');
      expect(result).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('getBlocks', () => {
    it('queries by districtKey', async () => {
      query.mockResolvedValueOnce([{ block_key: 555, block_name: 'BLOCK A' }]);
      const result = await service.getBlocks('999');
      expect(result).toEqual([{ key: '555', name: 'BLOCK A' }]);
      expect(query.mock.calls[0][1]).toEqual(['999']);
    });
  });

  describe('findState', () => {
    it('returns the state row when found', async () => {
      query.mockResolvedValueOnce([{ state_key: 111, state_name: 'UTTAR PRADESH' }]);
      const result = await service.findState('111');
      expect(result).toEqual({ stateKey: '111', stateName: 'UTTAR PRADESH' });
    });

    it('returns null when not found', async () => {
      query.mockResolvedValueOnce([]);
      expect(await service.findState('111')).toBeNull();
    });

    it('returns null for invalid key without querying', async () => {
      expect(await service.findState('x')).toBeNull();
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('findDistrict', () => {
    it('maps district with its parent state chain', async () => {
      query.mockResolvedValueOnce([
        { district_key: 999, district_name: 'MEERUT', state_key: 111, state_name: 'UP' },
      ]);
      const result = await service.findDistrict('999');
      expect(result).toEqual({
        districtKey: '999',
        districtName: 'MEERUT',
        stateKey: '111',
        stateName: 'UP',
      });
    });
  });

  describe('findBlock', () => {
    it('maps block with full parent chain', async () => {
      query.mockResolvedValueOnce([
        {
          block_key: 555,
          block_name: 'BLOCK A',
          district_key: 999,
          district_name: 'MEERUT',
          state_key: 111,
          state_name: 'UP',
        },
      ]);
      const result = await service.findBlock('555');
      expect(result).toEqual({
        blockKey: '555',
        blockName: 'BLOCK A',
        districtKey: '999',
        districtName: 'MEERUT',
        stateKey: '111',
        stateName: 'UP',
      });
    });
  });

  describe('getSchools', () => {
    it('is always scoped by cluster key (never unscoped)', async () => {
      query.mockResolvedValueOnce([{ udise_code: '09010100101', school_name: 'GPS A' }]);
      const result = await service.getSchools('777');
      expect(result).toEqual([{ key: '09010100101', name: 'GPS A' }]);
      expect(query.mock.calls[0][1]).toEqual(['777']);
    });

    it('returns [] for invalid cluster key without hitting the DB', async () => {
      expect(await service.getSchools('')).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });
  });
});

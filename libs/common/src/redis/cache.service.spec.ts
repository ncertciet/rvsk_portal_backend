import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };
    service = new CacheService(mockRedisClient);
  });

  describe('get()', () => {
    it('should return parsed JSON when Redis returns a value', async () => {
      const data = { userId: '123', role: 'admin' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(data));

      const result = await service.get<typeof data>('test-key');

      expect(result).toEqual(data);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when Redis returns null', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get('missing-key');

      expect(result).toBeNull();
    });

    it('should return null when Redis returns undefined', async () => {
      mockRedisClient.get.mockResolvedValue(undefined);

      const result = await service.get('missing-key');

      expect(result).toBeNull();
    });

    it('should return null (not throw) when Redis client throws an error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Connection refused'));

      const result = await service.get('some-key');

      expect(result).toBeNull();
    });

    it('should return null when Redis client throws a non-Error', async () => {
      mockRedisClient.get.mockRejectedValue('ECONNREFUSED');

      const result = await service.get('some-key');

      expect(result).toBeNull();
    });
  });

  describe('set()', () => {
    it('should call Redis set with EX when ttlSeconds is provided', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('key', { data: 'value' }, 300);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify({ data: 'value' }),
        'EX',
        300,
      );
    });

    it('should call Redis set without EX when no ttlSeconds provided', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('key', { data: 'value' });

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'key',
        JSON.stringify({ data: 'value' }),
      );
    });

    it('should complete without throwing when Redis client throws an error', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Connection refused'));

      // Should not throw
      await expect(service.set('key', 'value', 60)).resolves.toBeUndefined();
    });

    it('should complete without throwing when Redis client throws a non-Error', async () => {
      mockRedisClient.set.mockRejectedValue('ECONNREFUSED');

      await expect(service.set('key', 'value')).resolves.toBeUndefined();
    });
  });

  describe('del()', () => {
    it('should call Redis del with the key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.del('key-to-delete');

      expect(mockRedisClient.del).toHaveBeenCalledWith('key-to-delete');
    });

    it('should complete without throwing when Redis client throws an error', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Connection refused'));

      await expect(service.del('some-key')).resolves.toBeUndefined();
    });
  });

  describe('delPattern()', () => {
    it('should find keys by pattern and delete them', async () => {
      mockRedisClient.keys.mockResolvedValue(['menu:user1:admin', 'menu:user1:spoc']);
      mockRedisClient.del.mockResolvedValue(2);

      await service.delPattern('menu:user1:*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('menu:user1:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith('menu:user1:admin', 'menu:user1:spoc');
    });

    it('should not call del when no keys match the pattern', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await service.delPattern('nonexistent:*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('nonexistent:*');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should complete without throwing when Redis client throws an error', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Connection refused'));

      await expect(service.delPattern('menu:*')).resolves.toBeUndefined();
    });
  });
});

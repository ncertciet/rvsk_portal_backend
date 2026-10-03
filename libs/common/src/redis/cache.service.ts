import { Injectable, Inject, Logger } from '@nestjs/common';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: any,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redisClient.get(key);
      if (value === null || value === undefined) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error: any) {
      this.logger.warn(`Redis GET failed for key "${key}": ${error?.message || error}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.redisClient.set(key, serialized);
      }
    } catch (error: any) {
      this.logger.warn(`Redis SET failed for key "${key}": ${error?.message || error}`);
    }
  }

  /**
   * Batch-write many key/value pairs in one pipeline round-trip (used by the
   * attendance populator to write ~100k node blobs efficiently instead of one
   * awaited SET per key). Chunked so a single pipeline isn't unbounded. Fails
   * soft like the other methods.
   */
  async setMany(
    entries: { key: string; value: any }[],
    ttlSeconds?: number,
    chunkSize = 1000,
  ): Promise<void> {
    try {
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const pipe = this.redisClient.pipeline();
        for (const { key, value } of chunk) {
          const serialized = JSON.stringify(value);
          if (ttlSeconds) pipe.set(key, serialized, 'EX', ttlSeconds);
          else pipe.set(key, serialized);
        }
        await pipe.exec();
      }
    } catch (error: any) {
      this.logger.warn(`Redis pipeline SET failed (${entries.length} keys): ${error?.message || error}`);
    }
  }

  /**
   * Best-effort distributed lock (SET key token NX EX ttl). Returns true if this
   * caller acquired the lock. Used to guard once-per-cluster jobs (e.g. the
   * attendance nightly refresh) when the app runs multiple instances. On any
   * Redis error returns false (do NOT run the guarded job if we can't be sure).
   */
  async acquireLock(key: string, token: string, ttlSeconds: number): Promise<boolean> {
    try {
      const res = await this.redisClient.set(key, token, 'EX', ttlSeconds, 'NX');
      return res === 'OK';
    } catch (error: any) {
      this.logger.warn(`Redis lock acquire failed for "${key}": ${error?.message || error}`);
      return false;
    }
  }

  /** Release a lock only if we still own it (token matches), via a tiny Lua CAS. */
  async releaseLock(key: string, token: string): Promise<void> {
    try {
      const lua =
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';
      await this.redisClient.eval(lua, 1, key, token);
    } catch (error: any) {
      this.logger.warn(`Redis lock release failed for "${key}": ${error?.message || error}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redisClient.del(key);
    } catch (error: any) {
      this.logger.warn(`Redis DEL failed for key "${key}": ${error?.message || error}`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys && keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } catch (error: any) {
      this.logger.warn(`Redis DEL pattern failed for "${pattern}": ${error?.message || error}`);
    }
  }
}

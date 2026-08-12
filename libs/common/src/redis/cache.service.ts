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

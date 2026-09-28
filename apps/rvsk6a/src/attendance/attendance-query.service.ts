import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CacheService } from '@rvsk/common';

/**
 * Shared query plumbing for the attendance dashboard (design.md §14).
 *
 * Data path: the API reads PRE-COMPUTED per-node blobs from Redis (written by
 * the nightly cron). It does NOT query Oracle at request time in production.
 *
 * REDIS_ONLY switch (design.md §14.2):
 *   - true  (prod/default): Redis-only. A missing key → the caller returns
 *                           meta.empty. Never touches Oracle at request time.
 *   - false (dev/test):     on a Redis miss, the caller MAY compute live from
 *                           the Oracle MVs (via `dataSource`) so the dashboard
 *                           is usable before the cron has populated Redis.
 *
 * This service exposes the switch, the schema name, TTL, and a typed Redis
 * getter; page/trend services layer their own read + (dev) fallback on top.
 */
@Injectable()
export class AttendanceQueryService {
  private readonly logger = new Logger(AttendanceQueryService.name);

  readonly schema: string;
  readonly redisOnly: boolean;
  readonly ttlSeconds: number;
  readonly seriesMonths: number;

  constructor(
    readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.schema = this.configService.get<string>('RVSK6A_SCHEMA', 'RVSK6A');
    // REDIS_ONLY defaults to true (production posture). Accept "false" to opt out.
    this.redisOnly =
      String(this.configService.get('REDIS_ONLY', 'true')).toLowerCase() !== 'false';
    this.ttlSeconds = Number(
      this.configService.get('ATTENDANCE_CACHE_TTL_SECONDS', 172800),
    ); // 2 days
    this.seriesMonths = Number(this.configService.get('ATTENDANCE_SERIES_MONTHS', 6));
  }

  /** Typed Redis GET (JSON). Returns null on miss or Redis error (fails soft). */
  async get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  /** Warm a key (used by the dev fallback after a live compute). */
  async set(key: string, value: unknown): Promise<void> {
    await this.cache.set(key, value, this.ttlSeconds);
  }

  /** Run a live Oracle query (dev fallback / cron use only). */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.dataSource.query(sql, params);
  }

  /** Convenience: the latest ISO date (used as default snapshot / series end). */
  todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

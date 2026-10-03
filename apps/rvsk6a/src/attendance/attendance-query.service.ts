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
  /** Resolved read mode for the attendance dashboard (design.md §14.2). */
  readonly mode: 'true' | 'false' | 'bypass';
  readonly ttlSeconds: number;
  readonly seriesMonths: number;

  constructor(
    readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.schema = this.configService.get<string>('RVSK6A_SCHEMA', 'RVSK6A');

    // Per-dashboard read mode (3-way), resolved:
    //   ATTENDANCE_REDIS_ONLY ?? GLOBAL_REDIS_ONLY ?? 'true'
    //   'true'   = prod: Redis only; miss -> meta.empty (never ADW, except school leaf).
    //   'false'  = hybrid/dev: read Redis, miss -> compute from ADW MV + cache-through.
    //   'bypass' = perf test: ALWAYS compute from ADW MV, skip the Redis read entirely
    //              (ignores already-cached keys so ADW-direct latency can be logged).
    const raw = String(
      this.configService.get('ATTENDANCE_REDIS_ONLY') ??
        this.configService.get('GLOBAL_REDIS_ONLY') ??
        'true',
    ).toLowerCase().trim();
    this.mode = raw === 'bypass' ? 'bypass' : raw === 'false' ? 'false' : 'true';

    this.ttlSeconds = Number(
      this.configService.get('ATTENDANCE_CACHE_TTL_SECONDS', 172800),
    ); // 2 days
    this.seriesMonths = Number(this.configService.get('ATTENDANCE_SERIES_MONTHS', 6));
  }

  /** True in production posture: a Redis miss must NOT fall back to ADW. */
  get redisOnly(): boolean {
    return this.mode === 'true';
  }

  /** True in perf-test mode: skip the Redis read entirely and compute from ADW. */
  get bypassRedis(): boolean {
    return this.mode === 'bypass';
  }

  /** Typed Redis GET (JSON). Returns null on miss or Redis error (fails soft). */
  async get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  /** Warm a key (used by the dev fallback after a live compute). */
  async set(key: string, value: unknown): Promise<void> {
    await this.cache.set(key, value, this.ttlSeconds);
  }

  /** Batch-write many blobs in one pipeline (populator). TTL = the 2-day TTL. */
  async setMany(entries: { key: string; value: any }[]): Promise<void> {
    await this.cache.setMany(entries, this.ttlSeconds);
  }

  /** Run a live Oracle query (dev fallback / cron use only). */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.dataSource.query(sql, params);
  }

  /** Distributed lock passthrough (used by the scheduler to run once per cluster). */
  async acquireLock(key: string, token: string, ttlSeconds: number): Promise<boolean> {
    return this.cache.acquireLock(key, token, ttlSeconds);
  }
  async releaseLock(key: string, token: string): Promise<void> {
    return this.cache.releaseLock(key, token);
  }

  /**
   * Refresh the attendance Oracle MVs (REFRESH_ATTENDANCE_VIEWS proc). Called by
   * the nightly scheduler before the populator runs. Procedure name is schema-
   * qualified; CALL works for a parameterless PL/SQL procedure.
   */
  async refreshViews(): Promise<void> {
    await this.dataSource.query(`BEGIN ${this.schema}.REFRESH_ATTENDANCE_VIEWS; END;`);
  }

  /** Convenience: today's ISO date (fallback only). */
  todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * The default snapshot date = the most recent ATTENDANCE_DATE that actually
   * has data ("previous day"), NOT literally today (requirement B2). Cached in
   * Redis under `att:v1:meta:latestDate` (the populator refreshes it nightly;
   * here we also lazily cache for a short time so we don't hit Oracle on every
   * request when REDIS_ONLY=false and the key is absent).
   */
  async latestDataDate(): Promise<string> {
    const key = 'att:v1:meta:latestDate';
    const cached = await this.cache.get<string>(key);
    if (cached) return cached;

    // Not in Redis. In prod (REDIS_ONLY) we still need a sane default, so this
    // one tiny MAX() lookup is permitted even under REDIS_ONLY (it is O(1) on
    // the indexed MV, not a dashboard query).
    try {
      const rows = await this.dataSource.query(
        `SELECT TO_CHAR(MAX(ATTENDANCE_DATE),'YYYY-MM-DD') AS "d" FROM ${this.schema}.MV_ATT_GEO_DAY`,
      );
      const d: string = rows?.[0]?.d ?? this.todayISO();
      // short TTL so it tracks new data without a cron (1h); the populator also
      // sets this with the full 2-day TTL during its nightly run.
      await this.cache.set(key, d, 3600);
      return d;
    } catch (e: any) {
      this.logger.warn(`latestDataDate lookup failed, falling back to today: ${e?.message || e}`);
      return this.todayISO();
    }
  }
}

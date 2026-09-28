import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CacheService } from '@rvsk/common';

import { masterKey } from '../attendance/utils/cache-key.util';
import { ok, SuccessEnvelope } from '../attendance/interfaces/responses';
import {
  StateOption,
  DistrictOption,
  BlockOption,
  ClusterOption,
  SchoolOption,
} from '../attendance/interfaces/rows';

/**
 * Filter (master) service — Attendance Dashboard hierarchical filter cascade.
 *
 * Data source: ADW replica master views ONLY (design.md §2.3/§6.2, requirements
 * §2.3). The legacy flat WKSP_VSKDEV.SCHOOL table is NOT used.
 *
 * Keys: cascade on the numeric ..._KEY columns (align with JWT state_key/
 * district_key); ..._ID (VARCHAR2) is returned as a display/business code only.
 *
 * Caching: served from Redis (master:* namespace) with a live-ADW fallback on
 * miss (design.md §6.2, requirements §3.4). Cache failures degrade to a live
 * query (CacheService already fails soft), so filters never break if Redis is
 * down.
 */
@Injectable()
export class FiltersService {
  private readonly logger = new Logger(FiltersService.name);
  private readonly schema: string;
  /** Master-cache TTL (safety net; the nightly cron overwrites keys). Configurable. */
  private readonly masterTtl: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.schema = this.configService.get<string>('RVSK6A_SCHEMA', 'RVSK6A');
    // 48h default safety-net TTL (design.md §6.2 / Redis doc §2.4).
    this.masterTtl = this.configService.get<number>('MASTER_CACHE_TTL_SECONDS', 172800);
  }

  /**
   * Cache-aside helper: return cached list if present, else run the producer,
   * cache it, and return. Any Redis error degrades to a live query (CacheService
   * logs + returns null on failure).
   */
  private async cached<T>(key: string, producer: () => Promise<T[]>): Promise<T[]> {
    const hit = await this.cache.get<T[]>(key);
    if (hit !== null) {
      return hit;
    }
    const rows = await producer();
    await this.cache.set(key, rows, this.masterTtl);
    return rows;
  }

  async getStates(): Promise<SuccessEnvelope<StateOption[]>> {
    const rows = await this.cached<StateOption>(masterKey('states'), async () => {
      const sql = `
        SELECT TO_CHAR(STATE_KEY) AS "stateKey", STATE_ID AS "stateId", STATE_NAME AS "stateName"
        FROM ${this.schema}.VW_STATE_MASTER
        WHERE IS_ACTIVE = 1 AND STATE_NAME IS NOT NULL
        ORDER BY STATE_NAME
      `;
      return this.dataSource.query(sql);
    });
    return ok(rows);
  }

  /** Single state by key — for scoped users whose state is fixed by JWT. */
  async getStatesForKey(stateKey: string): Promise<SuccessEnvelope<StateOption[]>> {
    const rows = await this.cached<StateOption>(masterKey('state', stateKey), async () => {
      const sql = `
        SELECT TO_CHAR(STATE_KEY) AS "stateKey", STATE_ID AS "stateId", STATE_NAME AS "stateName"
        FROM ${this.schema}.VW_STATE_MASTER
        WHERE STATE_KEY = :1 AND IS_ACTIVE = 1
      `;
      return this.dataSource.query(sql, [stateKey]);
    });
    return ok(rows);
  }

  /** Single district by key — for district-scoped users. */
  async getDistrictsForKey(districtKey: string): Promise<SuccessEnvelope<DistrictOption[]>> {
    const rows = await this.cached<DistrictOption>(masterKey('district', districtKey), async () => {
      const sql = `
        SELECT TO_CHAR(DISTRICT_KEY) AS "districtKey", DISTRICT_ID AS "districtId", DISTRICT_NAME AS "districtName"
        FROM ${this.schema}.VW_DISTRICT_MASTER
        WHERE DISTRICT_KEY = :1 AND IS_ACTIVE = 1
      `;
      return this.dataSource.query(sql, [districtKey]);
    });
    return ok(rows);
  }

  async getDistricts(stateKey: string): Promise<SuccessEnvelope<DistrictOption[]>> {
    const rows = await this.cached<DistrictOption>(masterKey('districts', stateKey), async () => {
      const sql = `
        SELECT TO_CHAR(DISTRICT_KEY) AS "districtKey", DISTRICT_ID AS "districtId", DISTRICT_NAME AS "districtName"
        FROM ${this.schema}.VW_DISTRICT_MASTER
        WHERE STATE_KEY = :1 AND IS_ACTIVE = 1 AND DISTRICT_NAME IS NOT NULL
        ORDER BY DISTRICT_NAME
      `;
      return this.dataSource.query(sql, [stateKey]);
    });
    return ok(rows);
  }

  async getBlocks(districtKey: string): Promise<SuccessEnvelope<BlockOption[]>> {
    const rows = await this.cached<BlockOption>(masterKey('blocks', districtKey), async () => {
      const sql = `
        SELECT TO_CHAR(BLOCK_KEY) AS "blockKey", BLOCK_ID AS "blockId", BLOCK_NAME AS "blockName"
        FROM ${this.schema}.VW_BLOCK_MASTER
        WHERE DISTRICT_KEY = :1 AND IS_ACTIVE = 1 AND BLOCK_NAME IS NOT NULL
        ORDER BY BLOCK_NAME
      `;
      return this.dataSource.query(sql, [districtKey]);
    });
    return ok(rows);
  }

  async getClusters(blockKey: string): Promise<SuccessEnvelope<ClusterOption[]>> {
    const rows = await this.cached<ClusterOption>(masterKey('clusters', blockKey), async () => {
      const sql = `
        SELECT TO_CHAR(CLUSTER_KEY) AS "clusterKey", CLUSTER_ID AS "clusterId", CLUSTER_NAME AS "clusterName"
        FROM ${this.schema}.VW_CLUSTER_MASTER
        WHERE BLOCK_KEY = :1 AND IS_ACTIVE = 1 AND CLUSTER_NAME IS NOT NULL
        ORDER BY CLUSTER_NAME
      `;
      return this.dataSource.query(sql, [blockKey]);
    });
    return ok(rows);
  }

  /**
   * Schools filterable by ANY provided level in a single hop, because
   * VW_SCHOOL_MASTER carries all four parent ..._KEY columns directly
   * (design.md §6.2). `search` is applied server-side too (defence in depth);
   * the browser also filters the cached list client-side (design.md §3.3).
   *
   * The school list is cached by the deepest provided key. `search` is NOT part
   * of the cache key (it is a client-side filter over the cached list); when a
   * server `search` is supplied it is applied to the live query and bypasses the
   * cached list to avoid caching per-search-term slices.
   */
  async getSchools(params: {
    clusterKey?: string;
    blockKey?: string;
    districtKey?: string;
    stateKey?: string;
    search?: string;
  }): Promise<SuccessEnvelope<SchoolOption[]>> {
    const { clusterKey, blockKey, districtKey, stateKey, search } = params;

    const run = async (): Promise<SchoolOption[]> => {
      const binds: any[] = [];
      const conds: string[] = ['IS_ACTIVE = 1'];

      const addKey = (col: string, val?: string) => {
        if (val) {
          binds.push(val);
          conds.push(`${col} = :${binds.length}`);
        }
      };
      addKey('CLUSTER_KEY', clusterKey);
      addKey('BLOCK_KEY', blockKey);
      addKey('DISTRICT_KEY', districtKey);
      addKey('STATE_KEY', stateKey);

      if (search) {
        binds.push(`%${search.toUpperCase()}%`);
        const p = binds.length;
        conds.push(`(UPPER(SCHOOL_NAME) LIKE :${p} OR UPPER(UDISE_CODE) LIKE :${p})`);
      }

      const sql = `
        SELECT UDISE_CODE AS "udiseCode", SCHOOL_NAME AS "schoolName"
        FROM ${this.schema}.VW_SCHOOL_MASTER
        WHERE ${conds.join(' AND ')}
        ORDER BY SCHOOL_NAME
      `;
      return this.dataSource.query(sql, binds);
    };

    // Only cache the unfiltered (no server-side search) list, keyed by the
    // deepest provided level; searched requests hit ADW directly.
    if (search) {
      return ok(await run());
    }

    const deepest = (clusterKey && ['cluster', clusterKey]) ||
      (blockKey && ['block', blockKey]) ||
      (districtKey && ['district', districtKey]) ||
      (stateKey && ['state', stateKey]) || ['all', undefined as unknown as string];

    const rows = await this.cached<SchoolOption>(
      masterKey(`schools:${deepest[0]}`, deepest[1]),
      run,
    );
    return ok(rows);
  }
}

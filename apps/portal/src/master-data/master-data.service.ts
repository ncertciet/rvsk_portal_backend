import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * A single option for a cascading geo dropdown.
 * `key` is the authoritative bigint (as string); `name` is the display label.
 */
export interface MasterOption {
  key: string;
  name: string;
  /** Optional business/reference id (e.g. 2-char state code). Present for states. */
  code?: string;
}

/**
 * A resolved single row used for chain-consistency validation and name
 * snapshotting at write time.
 */
export interface StateRow {
  stateKey: string;
  stateName: string;
}
export interface DistrictRow {
  districtKey: string;
  districtName: string;
  stateKey: string;
  stateName: string;
}
export interface BlockRow {
  blockKey: string;
  blockName: string;
  districtKey: string;
  districtName: string;
  stateKey: string;
  stateName: string;
}

/**
 * RVSK-USR-MGMT-001.3 — Master-data source for the cascading
 * State → District → Block dropdowns, read from the rvsk_portal.vw_*_master
 * views. Options bind the *_key (bigint as string) and display the *_name.
 *
 * The service intentionally filters to active rows and orders by name for a
 * clean dropdown. Cluster/School reads are provided for future use but are
 * not wired into the user-creation flow yet.
 *
 * NOTE ON SCALE: schools number ~1.16M — never load all schools. School reads
 * are always scoped to a parent key.
 */
@Injectable()
export class MasterDataService {
  private readonly logger = new Logger(MasterDataService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ==================== DROPDOWN LISTS (cascading) ====================

  async getStates(): Promise<MasterOption[]> {
    const rows = await this.dataSource.query(
      `SELECT state_key, state_id, state_name
         FROM rvsk_portal.vw_state_master
        WHERE is_active = true
        ORDER BY state_name`,
    );
    return rows.map((r: any) => ({
      key: String(r.state_key),
      code: r.state_id != null ? String(r.state_id) : undefined,
      name: r.state_name,
    }));
  }

  async getDistricts(stateKey: string): Promise<MasterOption[]> {
    if (!this.isValidKey(stateKey)) return [];
    const rows = await this.dataSource.query(
      `SELECT district_key, district_name
         FROM rvsk_portal.vw_district_master
        WHERE state_key = $1
          AND is_active = true
        ORDER BY district_name`,
      [stateKey],
    );
    return rows.map((r: any) => ({
      key: String(r.district_key),
      name: r.district_name,
    }));
  }

  async getBlocks(districtKey: string): Promise<MasterOption[]> {
    if (!this.isValidKey(districtKey)) return [];
    const rows = await this.dataSource.query(
      `SELECT block_key, block_name
         FROM rvsk_portal.vw_block_master
        WHERE district_key = $1
          AND is_active = true
        ORDER BY block_name`,
      [districtKey],
    );
    return rows.map((r: any) => ({
      key: String(r.block_key),
      name: r.block_name,
    }));
  }

  /** Reserved for future use (cluster-level users not created yet). */
  async getClusters(blockKey: string): Promise<MasterOption[]> {
    if (!this.isValidKey(blockKey)) return [];
    const rows = await this.dataSource.query(
      `SELECT cluster_key, cluster_name
         FROM rvsk_portal.vw_cluster_master
        WHERE block_key = $1
          AND is_active = true
        ORDER BY cluster_name`,
      [blockKey],
    );
    return rows.map((r: any) => ({
      key: String(r.cluster_key),
      name: r.cluster_name,
    }));
  }

  /**
   * Reserved for future use. Always scoped to a parent (cluster) key — never
   * returns the full ~1.16M school set.
   */
  async getSchools(clusterKey: string): Promise<MasterOption[]> {
    if (!this.isValidKey(clusterKey)) return [];
    const rows = await this.dataSource.query(
      `SELECT udise_code, school_name
         FROM rvsk_portal.vw_school_master
        WHERE cluster_key = $1
          AND is_active = true
        ORDER BY school_name`,
      [clusterKey],
    );
    return rows.map((r: any) => ({
      key: String(r.udise_code),
      name: r.school_name,
    }));
  }

  // ==================== SINGLE-ROW LOOKUPS (validation + name snapshot) ====================

  /** Returns the state row for a key, or null if it does not exist. */
  async findState(stateKey: string): Promise<StateRow | null> {
    if (!this.isValidKey(stateKey)) return null;
    const rows = await this.dataSource.query(
      `SELECT state_key, state_name
         FROM rvsk_portal.vw_state_master
        WHERE state_key = $1`,
      [stateKey],
    );
    if (!rows.length) return null;
    return { stateKey: String(rows[0].state_key), stateName: rows[0].state_name };
  }

  /**
   * Returns the district row (with its parent state) for a key, or null.
   * Used to validate that a district belongs to the selected state.
   */
  async findDistrict(districtKey: string): Promise<DistrictRow | null> {
    if (!this.isValidKey(districtKey)) return null;
    const rows = await this.dataSource.query(
      `SELECT district_key, district_name, state_key, state_name
         FROM rvsk_portal.vw_district_master
        WHERE district_key = $1`,
      [districtKey],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      districtKey: String(r.district_key),
      districtName: r.district_name,
      stateKey: String(r.state_key),
      stateName: r.state_name,
    };
  }

  /**
   * Returns the block row (with its parent district + state) for a key, or null.
   * Used to validate that a block belongs to the selected district.
   */
  async findBlock(blockKey: string): Promise<BlockRow | null> {
    if (!this.isValidKey(blockKey)) return null;
    const rows = await this.dataSource.query(
      `SELECT block_key, block_name, district_key, district_name, state_key, state_name
         FROM rvsk_portal.vw_block_master
        WHERE block_key = $1`,
      [blockKey],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      blockKey: String(r.block_key),
      blockName: r.block_name,
      districtKey: String(r.district_key),
      districtName: r.district_name,
      stateKey: String(r.state_key),
      stateName: r.state_name,
    };
  }

  /**
   * Guard against SQL type errors: bigint keys must be all-digit strings.
   * Rejects null/empty/non-numeric input before it reaches the query.
   */
  private isValidKey(key: string | null | undefined): boolean {
    return typeof key === 'string' && /^\d+$/.test(key);
  }
}

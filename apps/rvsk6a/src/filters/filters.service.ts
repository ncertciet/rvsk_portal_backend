import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class FiltersService {
  private readonly adwSchema: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.adwSchema = this.configService.get<string>('ADW_SCHEMA', 'WKSP_VSKDEV');
  }

  private wrapResponse(data: any) {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  async getStates() {
    const sql = `
      SELECT DISTINCT STATE_ID, STATE_NAME
      FROM ${this.adwSchema}.SCHOOL
      WHERE STATE_NAME IS NOT NULL
      ORDER BY STATE_NAME
    `;
    const results = await this.dataSource.query(sql);
    return this.wrapResponse(results);
  }

  async getDistricts(stateId: string) {
    const sql = `
      SELECT DISTINCT DISTRICT_ID, DISTRICT_NAME
      FROM ${this.adwSchema}.SCHOOL
      WHERE STATE_ID = :1
        AND DISTRICT_NAME IS NOT NULL
      ORDER BY DISTRICT_NAME
    `;
    const results = await this.dataSource.query(sql, [stateId]);
    return this.wrapResponse(results);
  }

  async getBlocks(districtId: string) {
    const sql = `
      SELECT DISTINCT BLOCK_ID, BLOCK_NAME
      FROM ${this.adwSchema}.SCHOOL
      WHERE DISTRICT_ID = :1
        AND BLOCK_NAME IS NOT NULL
      ORDER BY BLOCK_NAME
    `;
    const results = await this.dataSource.query(sql, [districtId]);
    return this.wrapResponse(results);
  }

  async getClusters(blockId: string) {
    const sql = `
      SELECT DISTINCT CLUSTER_ID, CLUSTER_NAME
      FROM ${this.adwSchema}.SCHOOL
      WHERE BLOCK_ID = :1
        AND CLUSTER_NAME IS NOT NULL
      ORDER BY CLUSTER_NAME
    `;
    const results = await this.dataSource.query(sql, [blockId]);
    return this.wrapResponse(results);
  }

  async getSchools(clusterId: string) {
    const sql = `
      SELECT DISTINCT SCHOOL_ID, SCHOOL_NAME
      FROM ${this.adwSchema}.SCHOOL
      WHERE CLUSTER_ID = :1
        AND SCHOOL_NAME IS NOT NULL
      ORDER BY SCHOOL_NAME
    `;
    const results = await this.dataSource.query(sql, [clusterId]);
    return this.wrapResponse(results);
  }
}

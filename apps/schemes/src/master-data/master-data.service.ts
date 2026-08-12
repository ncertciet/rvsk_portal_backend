import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class MasterDataService {
  private readonly logger = new Logger(MasterDataService.name);
  private readonly schema: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.schema = this.configService.get<string>('RTIWARI_SCHEMA', 'RTIWARI');
  }

  async getAllStates() {
    const sql = `
      SELECT * FROM ${this.schema}.STATE_MASTER
      ORDER BY STATE_NAME
    `;
    return this.executeQuery(sql, []);
  }

  async getStateByCode(stateCode: string) {
    const sql = `
      SELECT * FROM ${this.schema}.STATE_MASTER
      WHERE STATE_CODE = :1
    `;
    const rows = await this.executeQuery(sql, [stateCode]);
    return rows.length > 0 ? rows[0] : null;
  }

  async getDistrictsByState(stateCode: string) {
    const sql = `
      SELECT * FROM ${this.schema}.DISTRICT_MASTER
      WHERE STATE_CODE = :1
      ORDER BY DISTRICT_NAME
    `;
    return this.executeQuery(sql, [stateCode]);
  }

  async getBlocksByDistrict(districtCode: string) {
    const sql = `
      SELECT * FROM ${this.schema}.BLOCK_MASTER
      WHERE DISTRICT_CODE = :1
      ORDER BY BLOCK_NAME
    `;
    return this.executeQuery(sql, [districtCode]);
  }

  async getClustersByBlock(blockCode: string) {
    const sql = `
      SELECT * FROM ${this.schema}.CLUSTER_MASTER
      WHERE BLOCK_CODE = :1
      ORDER BY CLUSTER_NAME
    `;
    return this.executeQuery(sql, [blockCode]);
  }

  async getCounts() {
    const [states, districts, blocks, clusters] = await Promise.all([
      this.executeQuery(`SELECT COUNT(*) AS cnt FROM ${this.schema}.STATE_MASTER`, []),
      this.executeQuery(`SELECT COUNT(*) AS cnt FROM ${this.schema}.DISTRICT_MASTER`, []),
      this.executeQuery(`SELECT COUNT(*) AS cnt FROM ${this.schema}.BLOCK_MASTER`, []),
      this.executeQuery(`SELECT COUNT(*) AS cnt FROM ${this.schema}.CLUSTER_MASTER`, []),
    ]);

    return {
      totalStates: states[0]?.CNT || 0,
      totalDistricts: districts[0]?.CNT || 0,
      totalBlocks: blocks[0]?.CNT || 0,
      totalClusters: clusters[0]?.CNT || 0,
    };
  }

  private async executeQuery(sql: string, params: string[]): Promise<any[]> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      try {
        const result = await queryRunner.query(sql, params);
        return result;
      } finally {
        await queryRunner.release();
      }
    } catch (error: any) {
      this.logger.error(`Query failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}

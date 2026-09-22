import { Controller, Get, Query } from '@nestjs/common';
import { MasterDataService, MasterOption } from './master-data.service';

/**
 * RVSK-USR-MGMT-001.3 — Cascading master-data endpoints backed by the
 * rvsk_portal.vw_*_master views. Consumed by the Create/Edit User geo
 * dropdowns (and, in future, the shared dashboard filters).
 *
 * All endpoints require authentication (global JWT guard); they are not
 * marked @Public. Every option is { key, name } where key is the bigint
 * (as string) and name is the display label.
 *
 * Routes (with API prefix): /api/v1/portal-masters/*
 * NOTE: prefix is 'portal-masters' (not 'master-data') to avoid colliding with
 * the schemes service's '/api/v1/master*' dev proxy + nginx routing.
 */
@Controller('portal-masters')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get('states')
  getStates(): Promise<MasterOption[]> {
    return this.masterDataService.getStates();
  }

  @Get('districts')
  getDistricts(@Query('stateKey') stateKey: string): Promise<MasterOption[]> {
    return this.masterDataService.getDistricts(stateKey);
  }

  @Get('blocks')
  getBlocks(@Query('districtKey') districtKey: string): Promise<MasterOption[]> {
    return this.masterDataService.getBlocks(districtKey);
  }

  /** Reserved for future use (cluster-level scoping not active yet). */
  @Get('clusters')
  getClusters(@Query('blockKey') blockKey: string): Promise<MasterOption[]> {
    return this.masterDataService.getClusters(blockKey);
  }

  /** Reserved for future use. Always scoped to a cluster key. */
  @Get('schools')
  getSchools(@Query('clusterKey') clusterKey: string): Promise<MasterOption[]> {
    return this.masterDataService.getSchools(clusterKey);
  }
}

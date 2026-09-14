import { Controller, Get, Param } from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { Public } from '@rvsk/common';

@Controller('master')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Public()
  @Get('states')
  async getAllStates() {
    const data = await this.masterDataService.getAllStates();
    return { success: true, timestamp: new Date().toISOString(), data };
  }

  @Public()
  @Get('states/:stateCode')
  async getStateByCode(@Param('stateCode') stateCode: string) {
    const data = await this.masterDataService.getStateByCode(stateCode);
    return { success: true, timestamp: new Date().toISOString(), data };
  }

  @Public()
  @Get('states/:stateCode/districts')
  async getDistrictsByState(@Param('stateCode') stateCode: string) {
    const data = await this.masterDataService.getDistrictsByState(stateCode);
    return { success: true, timestamp: new Date().toISOString(), data };
  }

  @Public()
  @Get('districts/:districtCode/blocks')
  async getBlocksByDistrict(@Param('districtCode') districtCode: string) {
    const data = await this.masterDataService.getBlocksByDistrict(districtCode);
    return { success: true, timestamp: new Date().toISOString(), data };
  }

  @Public()
  @Get('blocks/:blockCode/clusters')
  async getClustersByBlock(@Param('blockCode') blockCode: string) {
    const data = await this.masterDataService.getClustersByBlock(blockCode);
    return { success: true, timestamp: new Date().toISOString(), data };
  }

  @Public()
  @Get('counts')
  async getCounts() {
    const data = await this.masterDataService.getCounts();
    return { success: true, timestamp: new Date().toISOString(), data };
  }
}

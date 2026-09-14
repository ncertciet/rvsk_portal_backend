import { Controller, Get, Query } from '@nestjs/common';
import { FiltersService } from './filters.service';

@Controller('attendance/filters')
export class FiltersController {
  constructor(private readonly filtersService: FiltersService) {}

  @Get('states')
  getStates() {
    return this.filtersService.getStates();
  }

  @Get('districts')
  getDistricts(@Query('stateId') stateId: string) {
    return this.filtersService.getDistricts(stateId);
  }

  @Get('blocks')
  getBlocks(@Query('districtId') districtId: string) {
    return this.filtersService.getBlocks(districtId);
  }

  @Get('clusters')
  getClusters(@Query('blockId') blockId: string) {
    return this.filtersService.getClusters(blockId);
  }

  @Get('schools')
  getSchools(@Query('clusterId') clusterId: string) {
    return this.filtersService.getSchools(clusterId);
  }
}

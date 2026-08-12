import { Controller, Get, Param, Query } from '@nestjs/common';
import { SchemesService } from './schemes.service';
import { Public } from '@rvsk/common';

@Controller('api/v1/schemes')
export class SchemesController {
  constructor(private readonly schemesService: SchemesService) {}

  @Public()
  @Get(':schemeCode/kpis')
  async getKpis(
    @Param('schemeCode') schemeCode: string,
    @Query('stateName') stateName?: string,
  ) {
    return this.schemesService.getKpis(schemeCode, stateName);
  }

  @Public()
  @Get(':schemeCode/summary')
  async getSummary(
    @Param('schemeCode') schemeCode: string,
    @Query('stateName') stateName?: string,
  ) {
    return this.schemesService.getSummary(schemeCode, stateName);
  }

  @Public()
  @Get(':schemeCode/map')
  async getMapData(
    @Param('schemeCode') schemeCode: string,
    @Query('stateName') stateName?: string,
  ) {
    return this.schemesService.getMapData(schemeCode, stateName);
  }

  @Public()
  @Get(':schemeCode/statewise')
  async getStatewise(@Param('schemeCode') schemeCode: string) {
    return this.schemesService.getStatewise(schemeCode);
  }

  @Public()
  @Get(':schemeCode/districtwise')
  async getDistrictwise(
    @Param('schemeCode') schemeCode: string,
    @Query('stateName') stateName?: string,
  ) {
    return this.schemesService.getDistrictwise(schemeCode, stateName);
  }

  @Public()
  @Get(':schemeCode/schoolwise')
  async getSchoolwise(
    @Param('schemeCode') schemeCode: string,
    @Query('stateName') stateName?: string,
    @Query('districtName') districtName?: string,
  ) {
    return this.schemesService.getSchoolwise(schemeCode, stateName, districtName);
  }

  @Public()
  @Get(':schemeCode/charts')
  async getCharts(
    @Param('schemeCode') schemeCode: string,
    @Query('chartType') chartType?: string,
    @Query('stateName') stateName?: string,
  ) {
    return this.schemesService.getCharts(schemeCode, chartType, stateName);
  }

  @Public()
  @Get(':schemeCode/performance')
  async getPerformance(
    @Param('schemeCode') schemeCode: string,
    @Query('stateName') stateName?: string,
    @Query('districtName') districtName?: string,
  ) {
    return this.schemesService.getPerformance(schemeCode, stateName, districtName);
  }

  @Public()
  @Get(':schemeCode/filters')
  async getFilters(@Param('schemeCode') schemeCode: string) {
    return this.schemesService.getFilters(schemeCode);
  }

  @Public()
  @Get(':schemeCode/filters/districts')
  async getDistrictFilters(
    @Param('schemeCode') schemeCode: string,
    @Query('stateName') stateName?: string,
  ) {
    return this.schemesService.getDistrictFilters(schemeCode, stateName);
  }

  @Public()
  @Get(':schemeCode/filters/schools')
  async getSchoolFilters(
    @Param('schemeCode') schemeCode: string,
    @Query('stateName') stateName?: string,
    @Query('districtName') districtName?: string,
  ) {
    return this.schemesService.getSchoolFilters(schemeCode, stateName, districtName);
  }

  @Public()
  @Get(':schemeCode/detailed-stats')
  async getDetailedStats(
    @Param('schemeCode') schemeCode: string,
    @Query('stateName') stateName?: string,
    @Query('districtName') districtName?: string,
  ) {
    return this.schemesService.getDetailedStats(schemeCode, stateName, districtName);
  }
}

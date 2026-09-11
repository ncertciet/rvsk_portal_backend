import { Controller, Get, Post, Param, ParseIntPipe, Query, UseFilters } from '@nestjs/common';
import { Roles } from '@rvsk/common';
import { AccreditationService } from './accreditation.service';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';
import { AccreditationExceptionFilter } from './filters/accreditation-exception.filter';

@Controller('api/v1/accreditation/dashboard')
@UseFilters(AccreditationExceptionFilter)
export class AccreditationController {
  constructor(private readonly service: AccreditationService) {}

  @Get('programme-framework')
  getProgrammeFramework(@Query() filters: DashboardFiltersDto) {
    return this.service.getProgrammeFramework(filters);
  }

  @Get('coverage-reach')
  getCoverageReach(@Query() filters: DashboardFiltersDto) {
    return this.service.getCoverageReach(filters);
  }

  @Get('process-operations')
  getProcessOperations(@Query() filters: DashboardFiltersDto) {
    return this.service.getProcessOperations(filters);
  }

  @Get('process-operations/domain-components')
  getDomainComponents(@Query() filters: DashboardFiltersDto) {
    return this.service.getDomainComponents(filters);
  }

  @Get('data-quality')
  getDataQuality(@Query() filters: DashboardFiltersDto) {
    return this.service.getDataQuality(filters);
  }

  @Get('impact-outcomes')
  getImpactOutcomes(@Query() filters: DashboardFiltersDto) {
    return this.service.getImpactOutcomes(filters);
  }

  @Get('kpi/:kpiNo')
  getKpiByNumber(
    @Param('kpiNo', ParseIntPipe) kpiNo: number,
    @Query() filters: DashboardFiltersDto,
  ) {
    return this.service.getKpiByNumber(kpiNo, filters);
  }

  @Get('meta/academic-years')
  getAcademicYears() {
    return this.service.getAcademicYears();
  }

  @Get('meta/states')
  getStates() {
    return this.service.getStates();
  }

  @Post('refresh')
  @Roles('Ministry_Admin', 'RVSK_Admin')
  refreshViews() {
    return this.service.refreshViews();
  }
}

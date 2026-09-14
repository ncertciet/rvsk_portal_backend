import { Controller, Get, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('integration-coverage')
  getIntegrationCoverage() {
    return this.attendanceService.getIntegrationCoverage();
  }

  @Get('summary')
  getSummary(
    @Query('date') date: string,
    @Query('stateId') stateId?: string,
  ) {
    return this.attendanceService.getSummary(date, stateId);
  }

  @Get('state-table')
  getStateTable(@Query('date') date: string) {
    return this.attendanceService.getStateTable(date);
  }

  @Get('regional-leaders')
  getRegionalLeaders(@Query('date') date: string) {
    return this.attendanceService.getRegionalLeaders(date);
  }

  @Get('trends')
  getTrends(
    @Query('days') days?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('stateId') stateId?: string,
  ) {
    return this.attendanceService.getTrends(days, startDate, endDate, stateId);
  }

  @Get('detailed')
  getDetailed(
    @Query('date') date: string,
    @Query('stateId') stateId?: string,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('clusterId') clusterId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.attendanceService.getDetailed(
      date, stateId, districtId, blockId, clusterId,
      parseInt(page || '1', 10),
      parseInt(size || '20', 10),
    );
  }

  @Get('monthly')
  getMonthly(
    @Query('year') year: string,
    @Query('stateId') stateId?: string,
  ) {
    return this.attendanceService.getMonthly(year, stateId);
  }

  @Get('schools')
  getSchools(
    @Query('stateId') stateId?: string,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('date') date?: string,
  ) {
    return this.attendanceService.getSchools(
      stateId, districtId, blockId, search,
      parseInt(page || '1', 10),
      parseInt(size || '20', 10),
      date,
    );
  }

  @Get('teachers/dashboard')
  getTeachersDashboard(
    @Query('date') date: string,
    @Query('stateId') stateId?: string,
  ) {
    return this.attendanceService.getTeachersDashboard(date, stateId);
  }

  @Get('students/dashboard')
  getStudentsDashboard(
    @Query('date') date: string,
    @Query('stateId') stateId?: string,
  ) {
    return this.attendanceService.getStudentsDashboard(date, stateId);
  }

  @Get('report/school-management')
  getSchoolManagementReport(
    @Query('date') date: string,
    @Query('stateId') stateId?: string,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('clusterId') clusterId?: string,
  ) {
    return this.attendanceService.getSchoolManagementReport(
      date, stateId, districtId, blockId, clusterId,
    );
  }
}

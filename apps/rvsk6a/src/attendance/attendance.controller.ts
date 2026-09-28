import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '@rvsk/common';

import { AttendancePageService } from './attendance-page.service';
import { AttendanceTrendsService } from './attendance-trends.service';
import { AttendanceFiltersDto } from './dto/attendance-filters.dto';
import { AttendanceTrendDto } from './dto/attendance-trend.dto';

/**
 * Attendance Dashboard KPI endpoints (design.md §7 / §8 / §15).
 *
 * Auth: JwtAuthGuard is GLOBAL (CommonModule APP_GUARD) — a valid token is
 * already required; no @UseGuards here. Scope is enforced service-side from the
 * JWT (@CurrentUser), so a scoped user cannot read another jurisdiction.
 *
 * Data path: services read pre-computed per-node blobs from Redis (never Oracle
 * at request time in production; REDIS_ONLY=false enables a dev MV fallback).
 */
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly page: AttendancePageService,
    private readonly trends: AttendanceTrendsService,
  ) {}

  /** Page 1 — combined Attendance summary (design.md §15.1). */
  @Get('page/attendance')
  getAttendancePage(
    @Query() filters: AttendanceFiltersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.page.getAttendancePage(filters, user);
  }

  /** Page 2 — Trends (design.md §15.2). Split/lazy: default returns overall+teacher. */
  @Get('trend')
  getTrend(@Query() dto: AttendanceTrendDto, @CurrentUser() user: AuthenticatedUser) {
    return this.trends.getTrend(dto, user);
  }
}

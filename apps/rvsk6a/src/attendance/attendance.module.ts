import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceQueryService } from './attendance-query.service';
import { AttendancePageService } from './attendance-page.service';
import { AttendanceTrendsService } from './attendance-trends.service';
import { AttendancePopulatorService } from './attendance-populator.service';

/**
 * Attendance dashboard module (Pages 1 & 2). CacheService (Redis) and the Oracle
 * DataSource are provided globally (CommonModule / TypeOrmModule in app.module),
 * so no extra imports are needed.
 *
 * Services read pre-computed per-node blobs from Redis (design.md §14); Oracle
 * is only touched by the dev MV fallback (REDIS_ONLY=false) and the nightly cron.
 */
@Module({
  controllers: [AttendanceController],
  providers: [
    AttendanceQueryService,
    AttendancePageService,
    AttendanceTrendsService,
    AttendancePopulatorService,
  ],
  exports: [AttendanceQueryService, AttendancePopulatorService],
})
export class AttendanceModule {}

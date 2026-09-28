import { Module } from '@nestjs/common';
import { FiltersController } from './filters.controller';
import { FiltersService } from './filters.service';

/**
 * Attendance filter module. CacheService and the Oracle DataSource are provided
 * globally (CommonModule / RedisModule + TypeOrmModule in app.module), so no
 * extra imports are needed here.
 */
@Module({
  controllers: [FiltersController],
  providers: [FiltersService],
  exports: [FiltersService],
})
export class FiltersModule {}

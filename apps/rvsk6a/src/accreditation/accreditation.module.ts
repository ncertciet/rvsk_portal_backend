import { Module } from '@nestjs/common';
import { AccreditationController } from './accreditation.controller';
import { AccreditationService } from './accreditation.service';

/**
 * AccreditationModule reads exclusively from the Oracle ADW.
 * It uses the default (Oracle) TypeORM DataSource registered in AppModule —
 * the same pattern as AttendanceModule. No Postgres datasource is used.
 */
@Module({
  controllers: [AccreditationController],
  providers: [AccreditationService],
  exports: [AccreditationService],
})
export class AccreditationModule {}

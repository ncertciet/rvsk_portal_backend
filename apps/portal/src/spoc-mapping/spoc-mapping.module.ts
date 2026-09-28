import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StateSpocMapping } from './entities/state-spoc-mapping.entity';
import { PortalUser } from '../auth/entities/portal-user.entity';
import { Grievance } from '../grievance/entities/grievance.entity';
import { GrievanceHistory } from '../grievance/entities/grievance-history.entity';
import { SpocMappingService } from './spoc-mapping.service';
import { SpocMappingController } from './spoc-mapping.controller';
import { NotificationModule } from '../notification/notification.module';

/**
 * RVSK-GRV-SPOC-003 — State–SPOC Assignment.
 *
 * Owns the state_spoc_mapping table plus the Grievance/GrievanceHistory repos
 * it needs to refresh grievance ownership on reassignment (Option 1b). This
 * one-way dependency (GrievanceService → SpocMappingService) avoids a circular
 * import while keeping the mapping the single source of truth.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StateSpocMapping,
      PortalUser,
      Grievance,
      GrievanceHistory,
    ]),
    NotificationModule,
  ],
  controllers: [SpocMappingController],
  providers: [SpocMappingService],
  exports: [SpocMappingService],
})
export class SpocMappingModule {}

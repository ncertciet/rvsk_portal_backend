import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Grievance } from './entities/grievance.entity';
import { GrievanceResponse } from './entities/grievance-response.entity';
import { GrievanceHistory } from './entities/grievance-history.entity';
import { GrievanceAttachment } from './entities/grievance-attachment.entity';
import { PortalUser } from '../auth/entities/portal-user.entity';
import { GrievanceService } from './grievance.service';
import { GrievanceController } from './grievance.controller';
import { CategoriesModule } from '../categories/categories.module';
import { GrievanceAttachmentsModule } from '../grievance-attachments/grievance-attachments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Grievance,
      GrievanceResponse,
      GrievanceHistory,
      GrievanceAttachment,
      PortalUser,
    ]),
    CategoriesModule,
    GrievanceAttachmentsModule,
  ],
  controllers: [GrievanceController],
  providers: [GrievanceService],
  exports: [GrievanceService],
})
export class GrievanceModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PortalUser } from '../auth/entities/portal-user.entity';
import { Grievance } from '../grievance/entities/grievance.entity';
import { FormMaster } from '../forms/entities/form-master.entity';
import { ActivityLogEntry } from '../audit/entities/activity-log.entity';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PortalUser, Grievance, FormMaster, ActivityLogEntry])],
  controllers: [HomeController],
  providers: [HomeService],
  exports: [HomeService],
})
export class HomeModule {}

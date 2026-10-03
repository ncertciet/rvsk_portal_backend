import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VskProfile } from './entities/vsk-profile.entity';
import { VskPmuHeader } from './entities/vsk-pmu-header.entity';
import { VskPmuRoleStructure } from './entities/vsk-pmu-role-structure.entity';
import { VskSoftwareHeader } from './entities/vsk-software-header.entity';
import { VskSoftwareItem } from './entities/vsk-software-item.entity';
import { VskInfraHardware } from './entities/vsk-infra-hardware.entity';
import { VskOfficerHistory } from './entities/vsk-officer-history.entity';
import { VskCommitteeMember } from './entities/vsk-committee-member.entity';
import { VskService } from './vsk.service';
import { VskController } from './vsk.controller';
import { VskPdfService } from './vsk-pdf.service';
import { VskExportService } from './vsk-export.service';
import { StorageModule } from '../storage/storage.module';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VskProfile,
      VskPmuHeader,
      VskPmuRoleStructure,
      VskSoftwareHeader,
      VskSoftwareItem,
      VskInfraHardware,
      VskOfficerHistory,
      VskCommitteeMember,
    ]),
    StorageModule,
    MasterDataModule,
  ],
  controllers: [VskController],
  providers: [VskService, VskPdfService, VskExportService],
  exports: [VskService],
})
export class VskModule {}

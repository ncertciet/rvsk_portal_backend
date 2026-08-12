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
  ],
  controllers: [VskController],
  providers: [VskService],
  exports: [VskService],
})
export class VskModule {}

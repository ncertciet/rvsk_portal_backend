import { Module } from '@nestjs/common';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';

/**
 * RVSK-USR-MGMT-001.3 — Master-data module. Reads the rvsk_portal.vw_*_master
 * views for cascading geo dropdowns and exposes MasterDataService for
 * server-side chain validation + name snapshotting during user create/edit.
 *
 * Uses the default (portal) DataSource via @InjectDataSource, so no extra
 * TypeOrmModule.forFeature is needed (the views live in the same schema).
 */
@Module({
  controllers: [MasterDataController],
  providers: [MasterDataService],
  exports: [MasterDataService],
})
export class MasterDataModule {}

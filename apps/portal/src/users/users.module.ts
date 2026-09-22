import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortalUser } from '../auth/entities/portal-user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MasterDataModule } from '../master-data/master-data.module';

@Module({
  imports: [TypeOrmModule.forFeature([PortalUser]), MasterDataModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

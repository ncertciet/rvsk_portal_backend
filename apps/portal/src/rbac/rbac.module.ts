import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ModuleMaster,
  PageMaster,
  RolePageDefaultV2,
  UserPageOverrideV2,
} from './entities';
import { PortalUser } from '../auth/entities/portal-user.entity';
import { PermissionServiceV2 } from './permission.service';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { PermissionController } from './permission.controller';
import { ModuleController } from './module.controller';
import { PageController } from './page.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModuleMaster,
      PageMaster,
      RolePageDefaultV2,
      UserPageOverrideV2,
      PortalUser,
    ]),
  ],
  controllers: [
    MenuController,
    PermissionController,
    ModuleController,
    PageController,
  ],
  providers: [PermissionServiceV2, MenuService],
  exports: [PermissionServiceV2, MenuService, TypeOrmModule],
})
export class RbacModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PortalRole } from './entities/portal-role.entity';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

/**
 * RVSK-RBAC-ROLE-002-A — Roles module.
 * Exports RolesService so UsersService can resolve role_code -> portal_role
 * for the dual-write of portal_users.role_id.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PortalRole])],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService, TypeOrmModule],
})
export class RolesModule {}

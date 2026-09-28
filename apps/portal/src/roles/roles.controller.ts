import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles, CurrentUser, AuthenticatedUser } from '@rvsk/common';

import { RolesService } from './roles.service';
import { CreateRoleDto, RoleDto, UpdateRoleDto } from './dto/role.dto';

/**
 * RVSK-RBAC-ROLE-002-A — Roles API.
 *
 * Reads are available to any authenticated user (the frontend needs the active
 * role list for dropdowns). Mutations are restricted to Super_Admin / RVSK_Admin,
 * mirroring user-management authority.
 */
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /** List roles. Pass ?activeOnly=true for the frontend's active-role dropdowns. */
  @Get()
  async listRoles(@Query('activeOnly') activeOnly?: string): Promise<RoleDto[]> {
    return this.rolesService.listRoles(activeOnly === 'true');
  }

  @Roles('Super_Admin', 'RVSK_Admin')
  @Get(':id')
  async getRole(@Param('id') id: string): Promise<RoleDto> {
    return this.rolesService.getRoleById(id);
  }

  @Roles('Super_Admin', 'RVSK_Admin')
  @Post()
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<RoleDto> {
    const callerRole = user ? user.role : 'Super_Admin';
    return this.rolesService.createRole(dto, callerRole);
  }

  @Roles('Super_Admin', 'RVSK_Admin')
  @Put(':id')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleDto> {
    return this.rolesService.updateRole(id, dto);
  }

  @Roles('Super_Admin', 'RVSK_Admin')
  @Patch(':id/deactivate')
  async deactivateRole(@Param('id') id: string): Promise<RoleDto> {
    return this.rolesService.deactivateRole(id);
  }
}

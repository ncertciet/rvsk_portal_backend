import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '@rvsk/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListDto, CreateUserResponseDto, UserProfileDto } from './dto/user-list.dto';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * List all users with optional filters.
   * Super_Admin/RVSK_Admin see all. State_Admin sees own state.
   */
  @Roles('Super_Admin', 'RVSK_Admin', 'State_Admin')
  @Get()
  async listUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('role') role?: string,
    @Query('stateCode') stateCode?: string,
    @Query('search') search?: string,
  ): Promise<UserListDto[]> {
    return this.usersService.listUsers(
      user.role,
      user.stateCode,
      role,
      stateCode,
      search,
    );
  }

  /**
   * Get single user by ID.
   */
  @Roles('Super_Admin', 'RVSK_Admin', 'State_Admin')
  @Get(':id')
  async getUserById(@Param('id') id: string): Promise<UserProfileDto> {
    return this.usersService.getUserById(id);
  }

  /**
   * Create a new user with auto-generated temp password.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body() dto: CreateUserDto,
    @Headers('x-user-id') adminId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<CreateUserResponseDto> {
    const createdBy = adminId || (user ? user.userId : null);
    return this.usersService.createUser(dto, createdBy);
  }

  /**
   * Edit user (role, state, district, display name, etc.).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserListDto> {
    return this.usersService.updateUser(id, dto);
  }

  /**
   * Soft-delete user (deactivate).
   */
  @Roles('Super_Admin')
  @Delete(':id')
  async deleteUser(@Param('id') id: string): Promise<void> {
    return this.usersService.deleteUser(id);
  }

  /**
   * Reset user password — generates new temp, sets IS_FIRST_LOGIN=1.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Put(':id/reset-password')
  async resetPassword(
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string; tempPassword: string }> {
    return this.usersService.resetPassword(id);
  }

  /**
   * Unlock a locked account.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Put(':id/unlock')
  async unlockAccount(
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.usersService.unlockAccount(id);
  }

  /**
   * Toggle active/inactive status.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Put(':id/toggle-active')
  async toggleActive(
    @Param('id') id: string,
  ): Promise<{ success: boolean; isActive: boolean; message: string }> {
    return this.usersService.toggleActive(id);
  }

  /**
   * Activate user.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Put(':id/activate')
  async activateUser(
    @Param('id') id: string,
  ): Promise<{ success: boolean; isActive: boolean; message: string }> {
    return this.usersService.activateUser(id);
  }

  /**
   * Deactivate user.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Put(':id/deactivate')
  async deactivateUser(
    @Param('id') id: string,
  ): Promise<{ success: boolean; isActive: boolean; message: string }> {
    return this.usersService.deactivateUser(id);
  }
}

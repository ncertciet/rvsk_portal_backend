import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AppException } from '@rvsk/common';

import { PortalUser } from '../auth/entities/portal-user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  UserListDto,
  CreateUserResponseDto,
  UserProfileDto,
} from './dto/user-list.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly bcryptStrength: number;

  constructor(
    @InjectRepository(PortalUser)
    private readonly userRepo: Repository<PortalUser>,
    private readonly configService: ConfigService,
  ) {
    this.bcryptStrength = this.configService.get<number>('BCRYPT_STRENGTH', 12);
  }

  // ==================== LIST USERS ====================

  /**
   * List users with optional filters.
   * Super_Admin/RVSK_Admin sees all. State_Admin sees own state.
   * Filter by role, stateCode, and search (username/displayName).
   */
  async listUsers(
    callerRole: string,
    callerStateCode: string,
    role?: string,
    stateCode?: string,
    search?: string,
  ): Promise<UserListDto[]> {
    // Build query conditions
    const where: Record<string, unknown> = {};

    // State_Admin scope enforcement: can only see users in their own state
    if (callerRole === 'State_Admin') {
      where.stateCode = callerStateCode;
    } else {
      // Super_Admin / RVSK_Admin: apply optional stateCode filter
      if (stateCode) {
        where.stateCode = stateCode;
      }
    }

    // Apply role filter
    if (role) {
      where.role = role;
    }

    let users = await this.userRepo.find({ where });

    // Apply search filter on username and displayName
    if (search && search.trim() !== '') {
      const lowerSearch = search.toLowerCase();
      users = users.filter(
        (u) =>
          (u.username && u.username.toLowerCase().includes(lowerSearch)) ||
          (u.displayName && u.displayName.toLowerCase().includes(lowerSearch)),
      );
    }

    return users.map((u) => this.toUserListDto(u));
  }

  // ==================== GET USER BY ID ====================

  /**
   * Get user profile by ID. Throws 404 if not found.
   */
  async getUserById(id: string): Promise<UserProfileDto> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    return this.toUserProfileDto(user);
  }

  // ==================== CREATE USER ====================

  /**
   * Create a new user with auto-generated temp password.
   * Hash password with bcrypt, set createdBy, isActive=true, isFirstLogin=true.
   * Check username uniqueness (throw 409 USERNAME_EXISTS).
   */
  async createUser(
    dto: CreateUserDto,
    createdBy: string,
  ): Promise<CreateUserResponseDto> {
    // Check username uniqueness
    const existing = await this.userRepo.findOne({
      where: { username: dto.username },
    });

    if (existing) {
      throw new AppException(
        'Username already exists',
        HttpStatus.CONFLICT,
        'USERNAME_EXISTS',
      );
    }

    // Generate temp password: Rvsk@ + 4 random digits
    const tempPassword = this.generateTempPassword();

    // Hash the password
    const passwordHash = await bcrypt.hash(tempPassword, this.bcryptStrength);

    // Create user entity
    const user = this.userRepo.create({
      id: crypto.randomUUID(),
      username: dto.username,
      displayName: dto.displayName,
      passwordHash,
      role: dto.role,
      stateCode: dto.stateCode || null,
      districtCode: dto.districtCode || null,
      isActive: true,
      isFirstLogin: true,
      failedAttempts: 0,
      createdBy: createdBy,
    });

    const savedUser = await this.userRepo.save(user);
    this.logger.log(
      `User created: ${savedUser.username} with role: ${savedUser.role} by admin: ${createdBy}`,
    );

    return {
      success: true,
      message: 'User created successfully. Share credentials securely.',
      user: this.toUserListDto(savedUser),
      tempPassword,
    };
  }

  // ==================== UPDATE USER ====================

  /**
   * Update allowed fields: displayName, role, stateCode, districtCode, phone, email, etc.
   */
  async updateUser(id: string, dto: UpdateUserDto): Promise<UserListDto> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    if (dto.displayName !== undefined) user.displayName = dto.displayName;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.stateCode !== undefined) user.stateCode = dto.stateCode;
    // districtCode is always set (can be cleared to null)
    if ('districtCode' in dto) user.districtCode = dto.districtCode;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.designation !== undefined) user.designation = dto.designation;
    if (dto.department !== undefined) user.department = dto.department;
    if (dto.userEmail !== undefined) user.userEmail = dto.userEmail;
    if (dto.contactEmail !== undefined) user.contactEmail = dto.contactEmail;
    if (dto.mobileNumber !== undefined) user.mobileNumber = dto.mobileNumber;

    const savedUser = await this.userRepo.save(user);
    this.logger.log(`User edited: ${savedUser.username}`);

    return this.toUserListDto(savedUser);
  }

  // ==================== DELETE USER ====================

  /**
   * Soft-delete: set isActive=false.
   */
  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    user.isActive = false;
    await this.userRepo.save(user);
    this.logger.log(`User soft-deleted (deactivated): ${user.username}`);
  }

  // ==================== ACTIVATE USER ====================

  /**
   * Set isActive=true.
   */
  async activateUser(id: string): Promise<{ success: boolean; isActive: boolean; message: string }> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    user.isActive = true;
    await this.userRepo.save(user);
    this.logger.log(`User ${user.username} is now ACTIVE`);

    return { success: true, isActive: true, message: 'User activated' };
  }

  // ==================== DEACTIVATE USER ====================

  /**
   * Set isActive=false.
   */
  async deactivateUser(id: string): Promise<{ success: boolean; isActive: boolean; message: string }> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    user.isActive = false;
    await this.userRepo.save(user);
    this.logger.log(`User ${user.username} is now INACTIVE`);

    return { success: true, isActive: false, message: 'User deactivated' };
  }

  // ==================== TOGGLE ACTIVE ====================

  /**
   * Toggle active/inactive status (matches Java API contract).
   */
  async toggleActive(id: string): Promise<{ success: boolean; isActive: boolean; message: string }> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    const currentActive = user.isActive !== null ? user.isActive : true;
    user.isActive = !currentActive;
    await this.userRepo.save(user);
    this.logger.log(`User ${user.username} is now ${user.isActive ? 'ACTIVE' : 'INACTIVE'}`);

    return {
      success: true,
      isActive: user.isActive,
      message: user.isActive ? 'User activated' : 'User deactivated',
    };
  }

  // ==================== RESET PASSWORD ====================

  /**
   * Reset user password — generates new temp, sets IS_FIRST_LOGIN=1.
   */
  async resetPassword(id: string): Promise<{ success: boolean; message: string; tempPassword: string }> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    const tempPassword = this.generateTempPassword();
    user.passwordHash = await bcrypt.hash(tempPassword, this.bcryptStrength);
    user.isFirstLogin = true;
    user.failedAttempts = 0;
    user.lockedUntil = null;

    await this.userRepo.save(user);
    this.logger.log(`Password reset for user: ${user.username}`);

    return {
      success: true,
      message: 'Password reset. User must change on next login.',
      tempPassword,
    };
  }

  // ==================== UNLOCK ACCOUNT ====================

  /**
   * Unlock a locked account.
   */
  async unlockAccount(id: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new AppException(
        'User not found',
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
      );
    }

    user.failedAttempts = 0;
    user.lockedUntil = null;
    await this.userRepo.save(user);
    this.logger.log(`Account unlocked for user: ${user.username}`);

    return { success: true, message: 'Account unlocked' };
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Generate temp password: Rvsk@ + 4 random digits (1000-9999).
   */
  private generateTempPassword(): string {
    const digits = 1000 + Math.floor(Math.random() * 9000);
    return `Rvsk@${digits}`;
  }

  /**
   * Map PortalUser to UserListDto.
   */
  private toUserListDto(user: PortalUser): UserListDto {
    const dto = new UserListDto();
    dto.id = user.id;
    dto.username = user.username;
    dto.displayName = user.displayName;
    dto.role = user.role;
    dto.stateCode = user.stateCode;
    dto.districtCode = user.districtCode;
    dto.isActive = user.isActive;
    dto.lastLoginAt = user.lastLoginAt || null;
    return dto;
  }

  /**
   * Map PortalUser to UserProfileDto.
   */
  private toUserProfileDto(user: PortalUser): UserProfileDto {
    const dto = new UserProfileDto();
    dto.id = user.id;
    dto.username = user.username;
    dto.displayName = user.displayName;
    dto.role = user.role;
    dto.stateCode = user.stateCode;
    dto.districtCode = user.districtCode;
    dto.phone = user.phone;
    dto.designation = user.designation;
    dto.department = user.department;
    dto.isActive = user.isActive;
    dto.isFirstLogin = user.isFirstLogin;
    dto.lastLoginAt = user.lastLoginAt || null;
    dto.passwordChangedAt = user.passwordChangedAt || null;
    dto.createdAt = user.createdAt || null;
    return dto;
  }
}

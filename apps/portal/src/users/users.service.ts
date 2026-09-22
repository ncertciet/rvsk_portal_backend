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
import { MasterDataService } from '../master-data/master-data.service';
import {
  canCreateRole,
  geoLevelForRole,
  isNonGeoRole,
  isValidRole,
} from './user-roles';

/**
 * Resolved geo scope: the keys to persist plus the *_name snapshots looked up
 * from the master views. Null-filled for non-geo roles.
 */
interface ResolvedScope {
  stateKey: string | null;
  stateName: string | null;
  districtKey: string | null;
  districtName: string | null;
  blockKey: string | null;
  blockName: string | null;
}

const EMPTY_SCOPE: ResolvedScope = {
  stateKey: null,
  stateName: null,
  districtKey: null,
  districtName: null,
  blockKey: null,
  blockName: null,
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly bcryptStrength: number;

  constructor(
    @InjectRepository(PortalUser)
    private readonly userRepo: Repository<PortalUser>,
    private readonly configService: ConfigService,
    private readonly masterDataService: MasterDataService,
  ) {
    // ConfigService returns env values as strings; bcrypt.hash needs a numeric
    // salt-rounds value, so coerce explicitly (a string like "10" is otherwise
    // treated as a salt and throws "Invalid salt").
    const rounds = parseInt(String(this.configService.get('BCRYPT_STRENGTH', 12)), 10);
    this.bcryptStrength = Number.isNaN(rounds) ? 12 : rounds;
  }

  // ==================== ROLE + GEO VALIDATION HELPERS ====================

  /**
   * Resolve and validate the geo scope for a role (spec .2 / .8).
   * - Non-geo roles → all scope null (any provided keys are ignored/rejected).
   * - State_Admin → stateKey required.
   * - District_Admin → stateKey + districtKey required; district must belong
   *   to the state.
   * - Block_Admin → stateKey + districtKey + blockKey required; block must
   *   belong to the district, district to the state.
   * Names are snapshotted from the master views. Throws 400 on any violation.
   */
  private async resolveAndValidateScope(
    role: string,
    keys: { stateKey?: string | null; districtKey?: string | null; blockKey?: string | null },
  ): Promise<ResolvedScope> {
    const level = geoLevelForRole(role);

    // Non-geo roles must carry no scope.
    if (isNonGeoRole(role) || level === null) {
      if (keys.stateKey || keys.districtKey || keys.blockKey) {
        throw new AppException(
          `Role ${role} must not have a geographic scope`,
          HttpStatus.BAD_REQUEST,
          'GEO_NOT_ALLOWED',
        );
      }
      return { ...EMPTY_SCOPE };
    }

    // State is required for every geo role.
    if (!keys.stateKey) {
      throw new AppException(
        'State is required for this role',
        HttpStatus.BAD_REQUEST,
        'STATE_REQUIRED',
      );
    }
    const state = await this.masterDataService.findState(keys.stateKey);
    if (!state) {
      throw new AppException(
        'Selected state does not exist',
        HttpStatus.BAD_REQUEST,
        'INVALID_STATE',
      );
    }

    if (level === 'state') {
      // District/Block must not be set for a state-level role.
      if (keys.districtKey || keys.blockKey) {
        throw new AppException(
          'State_Admin must not carry a district or block',
          HttpStatus.BAD_REQUEST,
          'GEO_TOO_DEEP',
        );
      }
      return {
        ...EMPTY_SCOPE,
        stateKey: state.stateKey,
        stateName: state.stateName,
      };
    }

    // District required for district + block roles.
    if (!keys.districtKey) {
      throw new AppException(
        'District is required for this role',
        HttpStatus.BAD_REQUEST,
        'DISTRICT_REQUIRED',
      );
    }
    const district = await this.masterDataService.findDistrict(keys.districtKey);
    if (!district) {
      throw new AppException(
        'Selected district does not exist',
        HttpStatus.BAD_REQUEST,
        'INVALID_DISTRICT',
      );
    }
    if (district.stateKey !== state.stateKey) {
      throw new AppException(
        'Selected district does not belong to the selected state',
        HttpStatus.BAD_REQUEST,
        'CHAIN_MISMATCH',
      );
    }

    if (level === 'district') {
      if (keys.blockKey) {
        throw new AppException(
          'District_Admin must not carry a block',
          HttpStatus.BAD_REQUEST,
          'GEO_TOO_DEEP',
        );
      }
      return {
        ...EMPTY_SCOPE,
        stateKey: state.stateKey,
        stateName: state.stateName,
        districtKey: district.districtKey,
        districtName: district.districtName,
      };
    }

    // level === 'block'
    if (!keys.blockKey) {
      throw new AppException(
        'Block is required for this role',
        HttpStatus.BAD_REQUEST,
        'BLOCK_REQUIRED',
      );
    }
    const block = await this.masterDataService.findBlock(keys.blockKey);
    if (!block) {
      throw new AppException(
        'Selected block does not exist',
        HttpStatus.BAD_REQUEST,
        'INVALID_BLOCK',
      );
    }
    if (block.districtKey !== district.districtKey) {
      throw new AppException(
        'Selected block does not belong to the selected district',
        HttpStatus.BAD_REQUEST,
        'CHAIN_MISMATCH',
      );
    }

    return {
      stateKey: state.stateKey,
      stateName: state.stateName,
      districtKey: district.districtKey,
      districtName: district.districtName,
      blockKey: block.blockKey,
      blockName: block.blockName,
    };
  }

  // ==================== LIST USERS ====================

  /**
   * List users with optional filters.
   * Super_Admin/RVSK_Admin sees all. State_Admin sees own state.
   * Filter by role, stateCode, and search (username/displayName).
   */
  async listUsers(
    callerRole: string,
    callerStateKey: string | null,
    role?: string,
    stateKey?: string,
    search?: string,
  ): Promise<UserListDto[]> {
    // Build query conditions
    const where: Record<string, unknown> = {};

    // State_Admin scope enforcement: can only see users in their own state
    if (callerRole === 'State_Admin') {
      where.stateKey = callerStateKey;
    } else {
      // Super_Admin / RVSK_Admin: apply optional stateKey filter
      if (stateKey) {
        where.stateKey = stateKey;
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
    callerRole: string,
  ): Promise<CreateUserResponseDto> {
    // Validate the target role is a known role.
    if (!isValidRole(dto.role)) {
      throw new AppException(
        `Unknown role: ${dto.role}`,
        HttpStatus.BAD_REQUEST,
        'INVALID_ROLE',
      );
    }

    // Role-based creation authority (spec .1): RVSK_Admin cannot create Super_Admin.
    if (!canCreateRole(callerRole, dto.role)) {
      this.logger.warn(
        `Authority violation: ${callerRole} attempted to create role ${dto.role} (by ${createdBy})`,
      );
      throw new AppException(
        `You are not permitted to create a ${dto.role} user`,
        HttpStatus.FORBIDDEN,
        'CREATE_ROLE_FORBIDDEN',
      );
    }

    // Resolve + validate geo scope (spec .2 / .8) and snapshot names.
    const scope = await this.resolveAndValidateScope(dto.role, {
      stateKey: dto.stateKey,
      districtKey: dto.districtKey,
      blockKey: dto.blockKey,
    });

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

    // Reject a contact email already used by another user (clear message).
    await this.assertContactEmailAvailable(dto.contactEmail);

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
      stateKey: scope.stateKey,
      stateName: scope.stateName,
      districtKey: scope.districtKey,
      districtName: scope.districtName,
      blockKey: scope.blockKey,
      blockName: scope.blockName,
      phone: dto.phone ?? null,
      mobileNumber: dto.mobileNumber ?? null,
      designation: dto.designation ?? null,
      department: dto.department ?? null,
      userEmail: dto.userEmail ?? null,
      contactEmail: dto.contactEmail,
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

    // The effective role after this edit determines geo requirements.
    const effectiveRole = dto.role !== undefined ? dto.role : user.role;
    if (dto.role !== undefined) {
      if (!isValidRole(dto.role)) {
        throw new AppException(
          `Unknown role: ${dto.role}`,
          HttpStatus.BAD_REQUEST,
          'INVALID_ROLE',
        );
      }
      user.role = dto.role;
    }

    // Re-resolve geo scope whenever role or any geo key is part of the edit.
    // Use the incoming key when provided, else fall back to the stored key so
    // a role-only edit still validates against the existing chain.
    const roleChanged = dto.role !== undefined;
    const geoTouched =
      'stateKey' in dto || 'districtKey' in dto || 'blockKey' in dto;

    if (roleChanged || geoTouched) {
      const scope = await this.resolveAndValidateScope(effectiveRole, {
        stateKey: 'stateKey' in dto ? dto.stateKey : user.stateKey,
        districtKey: 'districtKey' in dto ? dto.districtKey : user.districtKey,
        blockKey: 'blockKey' in dto ? dto.blockKey : user.blockKey,
      });
      user.stateKey = scope.stateKey;
      user.stateName = scope.stateName;
      user.districtKey = scope.districtKey;
      user.districtName = scope.districtName;
      user.blockKey = scope.blockKey;
      user.blockName = scope.blockName;
    }

    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.mobileNumber !== undefined) user.mobileNumber = dto.mobileNumber;
    if (dto.designation !== undefined) user.designation = dto.designation;
    if (dto.department !== undefined) user.department = dto.department;
    if (dto.userEmail !== undefined) user.userEmail = dto.userEmail;
    if (dto.contactEmail !== undefined && dto.contactEmail !== null && dto.contactEmail !== '') {
      await this.assertContactEmailAvailable(dto.contactEmail, user.id);
      user.contactEmail = dto.contactEmail;
    } else if (dto.contactEmail !== undefined) {
      user.contactEmail = dto.contactEmail;
    }

    const savedUser = await this.userRepo.save(user);
    this.logger.log(`User edited: ${savedUser.username}`);

    return this.toUserListDto(savedUser);
  }

  /**
   * Throws a clear 409 if the contact email is already used by a different
   * user (case-insensitive). `excludeUserId` allows a user to keep their own.
   */
  private async assertContactEmailAvailable(
    contactEmail: string,
    excludeUserId?: string,
  ): Promise<void> {
    const matches = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.contactEmail) = LOWER(:email)', { email: contactEmail.trim() })
      .getMany();
    if (matches.some((u) => u.id !== excludeUserId)) {
      throw new AppException(
        'This contact email is already registered to another user. Please use a different email.',
        HttpStatus.CONFLICT,
        'CONTACT_EMAIL_EXISTS',
      );
    }
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
    dto.stateKey = user.stateKey ?? null;
    dto.stateName = user.stateName ?? null;
    dto.districtKey = user.districtKey ?? null;
    dto.districtName = user.districtName ?? null;
    dto.blockKey = user.blockKey ?? null;
    dto.blockName = user.blockName ?? null;
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
    dto.stateKey = user.stateKey ?? null;
    dto.stateName = user.stateName ?? null;
    dto.districtKey = user.districtKey ?? null;
    dto.districtName = user.districtName ?? null;
    dto.blockKey = user.blockKey ?? null;
    dto.blockName = user.blockName ?? null;
    dto.clusterKey = user.clusterKey ?? null;
    dto.clusterName = user.clusterName ?? null;
    dto.udiseCode = user.udiseCode ?? null;
    dto.schoolName = user.schoolName ?? null;
    dto.phone = user.phone;
    dto.mobileNumber = user.mobileNumber;
    dto.designation = user.designation;
    dto.department = user.department;
    dto.userEmail = user.userEmail;
    dto.contactEmail = user.contactEmail;
    dto.isActive = user.isActive;
    dto.isFirstLogin = user.isFirstLogin;
    dto.lastLoginAt = user.lastLoginAt || null;
    dto.passwordChangedAt = user.passwordChangedAt || null;
    dto.createdAt = user.createdAt || null;
    return dto;
  }
}

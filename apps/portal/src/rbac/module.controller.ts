import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Roles, CurrentUser, AuthenticatedUser, AppException } from '@rvsk/common';
import { ModuleMaster } from './entities/module-master.entity';

class CreateModuleDto {
  moduleCode: string;
  moduleName: string;
  icon?: string;
  displayOrder: number;
}

class UpdateModuleDto {
  moduleName?: string;
  icon?: string;
  displayOrder?: number;
  isActive?: boolean;
}

/**
 * Admin CRUD controller for ModuleMaster entities.
 * All endpoints require Super_Admin or RVSK_Admin role.
 */
@Roles('Super_Admin', 'RVSK_Admin')
@Controller('modules')
export class ModuleController {
  constructor(
    @InjectRepository(ModuleMaster)
    private readonly modulesRepo: Repository<ModuleMaster>,
  ) {}

  /**
   * GET /api/v1/modules
   * List all modules ordered by displayOrder.
   * Pass ?includeInactive=true to include deactivated modules.
   */
  @Get()
  async findAll(@Query('includeInactive') includeInactive?: string): Promise<ModuleMaster[]> {
    const where = includeInactive === 'true' ? {} : { isActive: true };
    return this.modulesRepo.find({
      where,
      order: { displayOrder: 'ASC' },
    });
  }

  /**
   * POST /api/v1/modules
   * Create a new module.
   */
  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: CreateModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ModuleMaster> {
    // Check for duplicate moduleCode
    const existing = await this.modulesRepo.findOne({
      where: { moduleCode: dto.moduleCode },
    });
    if (existing) {
      throw new AppException(
        `Module with code "${dto.moduleCode}" already exists`,
        HttpStatus.CONFLICT,
        'MODULE_CODE_EXISTS',
      );
    }

    const module = this.modulesRepo.create({
      id: uuidv4(),
      moduleCode: dto.moduleCode,
      moduleName: dto.moduleName,
      icon: dto.icon || null,
      displayOrder: dto.displayOrder,
      isActive: true,
      createdBy: user.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.modulesRepo.save(module);
  }

  /**
   * PUT /api/v1/modules/:id
   * Update an existing module.
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateModuleDto,
  ): Promise<ModuleMaster> {
    const module = await this.modulesRepo.findOne({ where: { id } });
    if (!module) {
      throw new AppException(
        `Module with id "${id}" not found`,
        HttpStatus.NOT_FOUND,
        'MODULE_NOT_FOUND',
      );
    }

    if (dto.moduleName !== undefined) module.moduleName = dto.moduleName;
    if (dto.icon !== undefined) module.icon = dto.icon;
    if (dto.displayOrder !== undefined) module.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) module.isActive = dto.isActive;
    module.updatedAt = new Date();

    return this.modulesRepo.save(module);
  }

  /**
   * DELETE /api/v1/modules/:id
   * Delete a module by ID.
   */
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    const module = await this.modulesRepo.findOne({ where: { id } });
    if (!module) {
      throw new AppException(
        `Module with id "${id}" not found`,
        HttpStatus.NOT_FOUND,
        'MODULE_NOT_FOUND',
      );
    }

    await this.modulesRepo.remove(module);
    return { success: true };
  }

  /**
   * PATCH /api/v1/modules/:id/activate
   * Activate a module.
   */
  @Patch(':id/activate')
  async activate(@Param('id') id: string): Promise<ModuleMaster> {
    const module = await this.modulesRepo.findOne({ where: { id } });
    if (!module) {
      throw new AppException(
        `Module with id "${id}" not found`,
        HttpStatus.NOT_FOUND,
        'MODULE_NOT_FOUND',
      );
    }

    module.isActive = true;
    module.updatedAt = new Date();
    return this.modulesRepo.save(module);
  }

  /**
   * PATCH /api/v1/modules/:id/deactivate
   * Deactivate a module.
   */
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string): Promise<ModuleMaster> {
    const module = await this.modulesRepo.findOne({ where: { id } });
    if (!module) {
      throw new AppException(
        `Module with id "${id}" not found`,
        HttpStatus.NOT_FOUND,
        'MODULE_NOT_FOUND',
      );
    }

    module.isActive = false;
    module.updatedAt = new Date();
    return this.modulesRepo.save(module);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Roles, AppException } from '@rvsk/common';
import { PageMaster } from './entities/page-master.entity';

class CreatePageDto {
  moduleId: string;
  pageCode: string;
  pageName: string;
  routePath: string;
  icon?: string;
  displayOrder: number;
}

class UpdatePageDto {
  pageName?: string;
  routePath?: string;
  icon?: string;
  displayOrder?: number;
  isActive?: boolean;
}

/**
 * Admin CRUD controller for PageMaster entities.
 * All endpoints require Super_Admin or RVSK_Admin role.
 */
@Roles('Super_Admin', 'RVSK_Admin')
@Controller('api/v1/pages')
export class PageController {
  constructor(
    @InjectRepository(PageMaster)
    private readonly pagesRepo: Repository<PageMaster>,
  ) {}

  /**
   * GET /api/v1/pages
   * List pages with optional moduleId and includeInactive filters.
   */
  @Get()
  async findAll(
    @Query('moduleId') moduleId?: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<PageMaster[]> {
    const where: any = {};
    if (moduleId) where.moduleId = moduleId;
    if (includeInactive !== 'true') where.isActive = true;
    return this.pagesRepo.find({
      where,
      relations: ['module'],
      order: { displayOrder: 'ASC' },
    });
  }

  /**
   * GET /api/v1/pages/by-module/:moduleId
   * List all pages for a specific module, ordered by displayOrder.
   */
  @Get('by-module/:moduleId')
  async findByModule(
    @Param('moduleId') moduleId: string,
  ): Promise<PageMaster[]> {
    return this.pagesRepo.find({
      where: { moduleId },
      relations: ['module'],
      order: { displayOrder: 'ASC' },
    });
  }

  /**
   * POST /api/v1/pages
   * Create a new page.
   */
  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreatePageDto): Promise<PageMaster> {
    // Validate required fields
    if (!dto.pageCode || !dto.pageName || !dto.routePath) {
      throw new AppException(
        'pageCode, pageName, and routePath are required',
        HttpStatus.BAD_REQUEST,
        'MISSING_REQUIRED_FIELDS',
      );
    }

    // Check for duplicate routePath
    const existingRoute = await this.pagesRepo.findOne({
      where: { routePath: dto.routePath },
    });
    if (existingRoute) {
      throw new AppException(
        `Page with route path "${dto.routePath}" already exists`,
        HttpStatus.CONFLICT,
        'PAGE_ROUTE_EXISTS',
      );
    }

    const page = this.pagesRepo.create({
      id: uuidv4(),
      moduleId: dto.moduleId,
      pageCode: dto.pageCode,
      pageName: dto.pageName,
      routePath: dto.routePath,
      icon: dto.icon || null,
      displayOrder: dto.displayOrder,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.pagesRepo.save(page);
  }

  /**
   * PUT /api/v1/pages/:id
   * Update an existing page.
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
  ): Promise<PageMaster> {
    const page = await this.pagesRepo.findOne({ where: { id } });
    if (!page) {
      throw new AppException(
        `Page with id "${id}" not found`,
        HttpStatus.NOT_FOUND,
        'PAGE_NOT_FOUND',
      );
    }

    if (dto.pageName !== undefined) page.pageName = dto.pageName;
    if (dto.routePath !== undefined) {
      // Check for duplicate routePath on update
      const existingRoute = await this.pagesRepo.findOne({
        where: { routePath: dto.routePath },
      });
      if (existingRoute && existingRoute.id !== id) {
        throw new AppException(
          `Page with route path "${dto.routePath}" already exists`,
          HttpStatus.CONFLICT,
          'PAGE_ROUTE_EXISTS',
        );
      }
      page.routePath = dto.routePath;
    }
    if (dto.icon !== undefined) page.icon = dto.icon;
    if (dto.displayOrder !== undefined) page.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) page.isActive = dto.isActive;
    page.updatedAt = new Date();

    return this.pagesRepo.save(page);
  }

  /**
   * DELETE /api/v1/pages/:id
   * Delete a page by ID.
   */
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    const page = await this.pagesRepo.findOne({ where: { id } });
    if (!page) {
      throw new AppException(
        `Page with id "${id}" not found`,
        HttpStatus.NOT_FOUND,
        'PAGE_NOT_FOUND',
      );
    }

    await this.pagesRepo.remove(page);
    return { success: true };
  }

  /**
   * PATCH /api/v1/pages/:id/activate
   * Activate a page.
   */
  @Patch(':id/activate')
  async activate(@Param('id') id: string): Promise<PageMaster> {
    const page = await this.pagesRepo.findOne({ where: { id } });
    if (!page) {
      throw new AppException(
        `Page with id "${id}" not found`,
        HttpStatus.NOT_FOUND,
        'PAGE_NOT_FOUND',
      );
    }

    page.isActive = true;
    page.updatedAt = new Date();
    return this.pagesRepo.save(page);
  }

  /**
   * PATCH /api/v1/pages/:id/deactivate
   * Deactivate a page.
   */
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string): Promise<PageMaster> {
    const page = await this.pagesRepo.findOne({ where: { id } });
    if (!page) {
      throw new AppException(
        `Page with id "${id}" not found`,
        HttpStatus.NOT_FOUND,
        'PAGE_NOT_FOUND',
      );
    }

    page.isActive = false;
    page.updatedAt = new Date();
    return this.pagesRepo.save(page);
  }
}

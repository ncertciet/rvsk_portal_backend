import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService, AppException } from '@rvsk/common';
import { HttpStatus } from '@nestjs/common';
import { GrievanceCategory } from './entities/grievance-category.entity';
import { CategoryTreeNode } from './interfaces/category-tree-node.interface';

const CACHE_KEY_CATEGORY_TREE = 'categories:tree';
const CACHE_TTL_SECONDS = 1800;

@Injectable()
export class GrievanceCategoryService {
  private readonly logger = new Logger(GrievanceCategoryService.name);

  constructor(
    @InjectRepository(GrievanceCategory)
    private readonly categoryRepo: Repository<GrievanceCategory>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get the full category tree: parent categories with their sub-categories.
   * Uses Redis cache with key "categories:tree" and TTL 1800s.
   */
  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    // Check Redis cache first
    const cached = await this.cacheService.get<CategoryTreeNode[]>(CACHE_KEY_CATEGORY_TREE);
    if (cached) {
      this.logger.debug('Category tree cache hit');
      return cached;
    }

    this.logger.debug('Category tree cache miss, querying database');

    // Query all active categories
    let allCategories;
    try {
      allCategories = await this.categoryRepo.find({
        where: { isActive: true },
        order: { sortOrder: 'ASC' },
      });
    } catch (error: any) {
      this.logger.warn(`Failed to query categories table: ${error?.message || error}. Returning empty tree.`);
      return [];
    }

    // Separate parents (parentCode is null) and children
    const parents = allCategories.filter((c) => !c.parentCode);
    const childrenMap = new Map<string, GrievanceCategory[]>();

    for (const category of allCategories) {
      if (category.parentCode) {
        const existing = childrenMap.get(category.parentCode) || [];
        existing.push(category);
        childrenMap.set(category.parentCode, existing);
      }
    }

    // Build tree structure
    const tree: CategoryTreeNode[] = parents.map((parent) => {
      const children = childrenMap.get(parent.code) || [];
      // Children are already sorted by sortOrder from the query
      return {
        code: parent.code,
        label: parent.label,
        sortOrder: parent.sortOrder,
        subCategories: children.map((child) => ({
          code: child.code,
          label: child.label,
          sortOrder: child.sortOrder,
        })),
      };
    });

    // Cache the result
    await this.cacheService.set(CACHE_KEY_CATEGORY_TREE, tree, CACHE_TTL_SECONDS);

    return tree;
  }

  /**
   * Get sub-categories for a given parent code.
   */
  async getSubCategories(parentCode: string): Promise<GrievanceCategory[]> {
    return this.categoryRepo.find({
      where: { parentCode, isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  /**
   * Add a new category or sub-category.
   * Invalidates the category tree cache.
   */
  async addCategory(
    code: string,
    label: string,
    parentCode?: string,
    sortOrder?: number,
  ): Promise<GrievanceCategory> {
    const category = this.categoryRepo.create({
      code,
      label,
      parentCode: parentCode || null,
      sortOrder: sortOrder ?? 0,
      isActive: true,
    });

    const saved = await this.categoryRepo.save(category);

    // Invalidate cache
    await this.cacheService.del(CACHE_KEY_CATEGORY_TREE);
    this.logger.log(`Category added: ${code}, cache invalidated`);

    return saved;
  }

  /**
   * Edit an existing category by its code.
   * Invalidates the category tree cache.
   */
  async editCategory(
    code: string,
    label?: string,
    sortOrder?: number,
    isActive?: boolean,
  ): Promise<GrievanceCategory> {
    const category = await this.categoryRepo.findOne({ where: { code } });

    if (!category) {
      throw new AppException(
        `Category not found: ${code}`,
        HttpStatus.NOT_FOUND,
        'CATEGORY_NOT_FOUND',
      );
    }

    if (label !== undefined) {
      category.label = label;
    }
    if (sortOrder !== undefined) {
      category.sortOrder = sortOrder;
    }
    if (isActive !== undefined) {
      category.isActive = isActive;
    }

    const saved = await this.categoryRepo.save(category);

    // Invalidate cache
    await this.cacheService.del(CACHE_KEY_CATEGORY_TREE);
    this.logger.log(`Category edited: ${code}, cache invalidated`);

    return saved;
  }
}

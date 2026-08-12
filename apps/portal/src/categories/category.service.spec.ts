import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpStatus } from '@nestjs/common';
import { GrievanceCategoryService } from './category.service';
import { GrievanceCategory } from './entities/grievance-category.entity';
import { CacheService, AppException } from '@rvsk/common';

describe('GrievanceCategoryService', () => {
  let service: GrievanceCategoryService;
  let categoryRepo: jest.Mocked<Partial<Repository<GrievanceCategory>>>;
  let cacheService: jest.Mocked<Partial<CacheService>>;

  const mockCategories: Partial<GrievanceCategory>[] = [
    { id: '1', code: 'TECHNICAL', label: 'Technical Issues', parentCode: null, sortOrder: 1, isActive: true },
    { id: '2', code: 'ADMIN', label: 'Administrative', parentCode: null, sortOrder: 2, isActive: true },
    { id: '3', code: 'TECH_NETWORK', label: 'Network Problems', parentCode: 'TECHNICAL', sortOrder: 1, isActive: true },
    { id: '4', code: 'TECH_SOFTWARE', label: 'Software Issues', parentCode: 'TECHNICAL', sortOrder: 2, isActive: true },
    { id: '5', code: 'ADMIN_HR', label: 'HR Related', parentCode: 'ADMIN', sortOrder: 1, isActive: true },
  ];

  beforeEach(async () => {
    categoryRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrievanceCategoryService,
        { provide: getRepositoryToken(GrievanceCategory), useValue: categoryRepo },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<GrievanceCategoryService>(GrievanceCategoryService);
  });

  describe('getCategoryTree', () => {
    it('should return cached tree if available', async () => {
      const cachedTree = [
        { code: 'TECHNICAL', label: 'Technical Issues', sortOrder: 1, subCategories: [] },
      ];
      cacheService.get.mockResolvedValue(cachedTree);

      const result = await service.getCategoryTree();

      expect(result).toEqual(cachedTree);
      expect(cacheService.get).toHaveBeenCalledWith('categories:tree');
      expect(categoryRepo.find).not.toHaveBeenCalled();
    });

    it('should query database and build tree on cache miss', async () => {
      cacheService.get.mockResolvedValue(null);
      categoryRepo.find.mockResolvedValue(mockCategories as GrievanceCategory[]);

      const result = await service.getCategoryTree();

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('TECHNICAL');
      expect(result[0].subCategories).toHaveLength(2);
      expect(result[0].subCategories[0].code).toBe('TECH_NETWORK');
      expect(result[0].subCategories[1].code).toBe('TECH_SOFTWARE');
      expect(result[1].code).toBe('ADMIN');
      expect(result[1].subCategories).toHaveLength(1);
      expect(result[1].subCategories[0].code).toBe('ADMIN_HR');
    });

    it('should cache the tree with TTL 1800s after building', async () => {
      cacheService.get.mockResolvedValue(null);
      categoryRepo.find.mockResolvedValue(mockCategories as GrievanceCategory[]);

      await service.getCategoryTree();

      expect(cacheService.set).toHaveBeenCalledWith(
        'categories:tree',
        expect.any(Array),
        1800,
      );
    });

    it('should return empty array when no active categories exist', async () => {
      cacheService.get.mockResolvedValue(null);
      categoryRepo.find.mockResolvedValue([]);

      const result = await service.getCategoryTree();

      expect(result).toEqual([]);
    });

    it('should return parent with empty subCategories when no children exist', async () => {
      cacheService.get.mockResolvedValue(null);
      categoryRepo.find.mockResolvedValue([
        { id: '1', code: 'LONE', label: 'Lone Parent', parentCode: null, sortOrder: 1, isActive: true },
      ] as GrievanceCategory[]);

      const result = await service.getCategoryTree();

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('LONE');
      expect(result[0].subCategories).toEqual([]);
    });
  });

  describe('getSubCategories', () => {
    it('should query active sub-categories for given parent code', async () => {
      const children = [
        { id: '3', code: 'TECH_NETWORK', label: 'Network Problems', parentCode: 'TECHNICAL', sortOrder: 1, isActive: true },
        { id: '4', code: 'TECH_SOFTWARE', label: 'Software Issues', parentCode: 'TECHNICAL', sortOrder: 2, isActive: true },
      ] as GrievanceCategory[];
      categoryRepo.find.mockResolvedValue(children);

      const result = await service.getSubCategories('TECHNICAL');

      expect(result).toEqual(children);
      expect(categoryRepo.find).toHaveBeenCalledWith({
        where: { parentCode: 'TECHNICAL', isActive: true },
        order: { sortOrder: 'ASC' },
      });
    });

    it('should return empty array when no sub-categories found', async () => {
      categoryRepo.find.mockResolvedValue([]);

      const result = await service.getSubCategories('NON_EXISTENT');

      expect(result).toEqual([]);
    });
  });

  describe('addCategory', () => {
    it('should create a new category and invalidate cache', async () => {
      const newCategory = {
        id: 'new-uuid',
        code: 'NEW_CAT',
        label: 'New Category',
        parentCode: null,
        sortOrder: 0,
        isActive: true,
      } as GrievanceCategory;

      categoryRepo.create.mockReturnValue(newCategory);
      categoryRepo.save.mockResolvedValue(newCategory);

      const result = await service.addCategory('NEW_CAT', 'New Category');

      expect(categoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NEW_CAT',
          label: 'New Category',
          parentCode: null,
          sortOrder: 0,
          isActive: true,
        }),
      );
      expect(categoryRepo.save).toHaveBeenCalled();
      expect(cacheService.del).toHaveBeenCalledWith('categories:tree');
      expect(result).toEqual(newCategory);
    });

    it('should create a sub-category with parentCode', async () => {
      const subCategory = {
        id: 'sub-uuid',
        code: 'TECH_HARDWARE',
        label: 'Hardware Issues',
        parentCode: 'TECHNICAL',
        sortOrder: 3,
        isActive: true,
      } as GrievanceCategory;

      categoryRepo.create.mockReturnValue(subCategory);
      categoryRepo.save.mockResolvedValue(subCategory);

      const result = await service.addCategory('TECH_HARDWARE', 'Hardware Issues', 'TECHNICAL', 3);

      expect(categoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TECH_HARDWARE',
          label: 'Hardware Issues',
          parentCode: 'TECHNICAL',
          sortOrder: 3,
          isActive: true,
        }),
      );
      expect(result).toEqual(subCategory);
    });
  });

  describe('editCategory', () => {
    it('should update category fields and invalidate cache', async () => {
      const existing = {
        id: '1',
        code: 'TECHNICAL',
        label: 'Technical Issues',
        parentCode: null,
        sortOrder: 1,
        isActive: true,
      } as GrievanceCategory;

      const updated = { ...existing, label: 'Tech Problems', sortOrder: 5 } as GrievanceCategory;

      categoryRepo.findOne.mockResolvedValue(existing);
      categoryRepo.save.mockResolvedValue(updated);

      const result = await service.editCategory('TECHNICAL', 'Tech Problems', 5);

      expect(categoryRepo.findOne).toHaveBeenCalledWith({ where: { code: 'TECHNICAL' } });
      expect(categoryRepo.save).toHaveBeenCalled();
      expect(cacheService.del).toHaveBeenCalledWith('categories:tree');
      expect(result).toEqual(updated);
    });

    it('should throw AppException when category not found', async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(service.editCategory('UNKNOWN', 'Label'))
        .rejects
        .toThrow(AppException);

      try {
        await service.editCategory('UNKNOWN', 'Label');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should deactivate a category', async () => {
      const existing = {
        id: '1',
        code: 'TECHNICAL',
        label: 'Technical Issues',
        parentCode: null,
        sortOrder: 1,
        isActive: true,
      } as GrievanceCategory;

      const deactivated = { ...existing, isActive: false } as GrievanceCategory;

      categoryRepo.findOne.mockResolvedValue(existing);
      categoryRepo.save.mockResolvedValue(deactivated);

      const result = await service.editCategory('TECHNICAL', undefined, undefined, false);

      expect(result.isActive).toBe(false);
      expect(cacheService.del).toHaveBeenCalledWith('categories:tree');
    });
  });
});

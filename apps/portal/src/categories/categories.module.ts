import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrievanceCategory } from './entities/grievance-category.entity';
import { GrievanceCategoryService } from './category.service';

@Module({
  imports: [TypeOrmModule.forFeature([GrievanceCategory])],
  controllers: [],
  providers: [GrievanceCategoryService],
  exports: [GrievanceCategoryService],
})
export class CategoriesModule {}

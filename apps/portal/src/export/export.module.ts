import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormExportService } from './export.service';
import { FormResponse } from '../responses/entities/form-response.entity';
import { FormAnswer } from '../responses/entities/form-answer.entity';
import { FormQuestion } from '../questions/entities/form-question.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FormResponse, FormAnswer, FormQuestion])],
  controllers: [],
  providers: [FormExportService],
  exports: [FormExportService],
})
export class ExportModule {}

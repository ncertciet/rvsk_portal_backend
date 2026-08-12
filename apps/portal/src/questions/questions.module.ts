import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormQuestion } from './entities/form-question.entity';
import { FormMaster } from '../forms/entities/form-master.entity';
import { FormQuestionService } from './question.service';

@Module({
  imports: [TypeOrmModule.forFeature([FormQuestion, FormMaster])],
  controllers: [],
  providers: [FormQuestionService],
  exports: [TypeOrmModule, FormQuestionService],
})
export class QuestionsModule {}

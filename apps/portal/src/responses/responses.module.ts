import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormResponse } from './entities/form-response.entity';
import { FormAnswer } from './entities/form-answer.entity';
import { FormQuestion } from '../questions/entities/form-question.entity';
import { FormMaster } from '../forms/entities/form-master.entity';
import { PortalUser } from '../auth/entities/portal-user.entity';
import { FormResponseService } from './response.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FormResponse,
      FormAnswer,
      FormQuestion,
      FormMaster,
      PortalUser,
    ]),
    NotificationModule,
  ],
  controllers: [],
  providers: [FormResponseService],
  exports: [TypeOrmModule, FormResponseService],
})
export class ResponsesModule {}

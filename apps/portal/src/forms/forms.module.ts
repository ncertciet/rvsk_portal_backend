import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormMaster } from './entities/form-master.entity';
import { FormAssignment } from './entities/form-assignment.entity';
import { FormQuestion } from '../questions/entities/form-question.entity';
import { PortalUser } from '../auth/entities/portal-user.entity';
import { FormService } from './form.service';
import { FormsController } from './forms.controller';
import { QuestionsModule } from '../questions/questions.module';
import { ResponsesModule } from '../responses/responses.module';
import { ExportModule } from '../export/export.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FormMaster,
      FormAssignment,
      FormQuestion,
      PortalUser,
    ]),
    QuestionsModule,
    ResponsesModule,
    ExportModule,
    NotificationModule,
  ],
  controllers: [FormsController],
  providers: [FormService],
  exports: [TypeOrmModule, FormService],
})
export class FormsModule {}

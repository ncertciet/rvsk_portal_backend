import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GrievanceAttachment } from '../grievance/entities/grievance-attachment.entity';
import { GrievanceFileService } from './file.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GrievanceAttachment]),
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
      },
    }),
  ],
  controllers: [],
  providers: [GrievanceFileService],
  exports: [GrievanceFileService],
})
export class GrievanceAttachmentsModule {}

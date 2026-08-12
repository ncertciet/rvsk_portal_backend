import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';

import { GalleryImage } from './gallery.entity';
import { GalleryService } from './gallery.service';
import { GalleryController } from './gallery.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([GalleryImage]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max for gallery images
      },
    }),
  ],
  controllers: [GalleryController],
  providers: [GalleryService],
  exports: [GalleryService],
})
export class GalleryModule {}

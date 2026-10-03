import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';

import { VskEvent } from './entities/vsk-event.entity';
import { VskEventImage } from './entities/vsk-event-image.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VskEvent, VskEventImage]),
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per event image
    }),
    StorageModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}

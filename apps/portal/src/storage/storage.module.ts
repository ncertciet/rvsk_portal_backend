import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';

/**
 * Shared file-storage module. Provides {@link FileStorageService} to any
 * feature that persists uploads (VSK infra, gallery, events).
 */
@Module({
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class StorageModule {}

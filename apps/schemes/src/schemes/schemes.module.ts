import { Module } from '@nestjs/common';
import { SchemesController } from './schemes.controller';
import { SchemesService } from './schemes.service';

@Module({
  controllers: [SchemesController],
  providers: [SchemesService],
  exports: [SchemesService],
})
export class SchemesModule {}

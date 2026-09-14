import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule, createOracleDataSource } from '@rvsk/common';

import { AttendanceModule } from './attendance/attendance.module';
import { AccreditationModule } from './accreditation/accreditation.module';
import { FiltersModule } from './filters/filters.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...createOracleDataSource(config),
        autoLoadEntities: true,
      }),
    }),
    CommonModule,
    AttendanceModule,
    FiltersModule,
    AccreditationModule,
  ],
})
export class AppModule {}

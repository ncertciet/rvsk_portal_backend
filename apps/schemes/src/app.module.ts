import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule, createOracleDataSource } from '@rvsk/common';

import { SchemesModule } from './schemes/schemes.module';
import { MasterDataModule } from './master-data/master-data.module';
import { ReportsModule } from './reports/reports.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
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
    SchemesModule,
    MasterDataModule,
    ReportsModule,
  ],
})
export class AppModule {}

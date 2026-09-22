import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { CommonModule, createPostgresDataSource } from '@rvsk/common';

// Auth modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RbacModule } from './rbac/rbac.module';
import { MasterDataModule } from './master-data/master-data.module';
import { VskModule } from './vsk/vsk.module';
import { HomeModule } from './home/home.module';
import { GalleryModule } from './gallery/gallery.module';

// Grievance modules
import { GrievanceModule } from './grievance/grievance.module';
import { CategoriesModule } from './categories/categories.module';
import { GrievanceAttachmentsModule } from './grievance-attachments/grievance-attachments.module';

// Forms modules
import { FormsModule } from './forms/forms.module';
import { QuestionsModule } from './questions/questions.module';
import { ResponsesModule } from './responses/responses.module';
import { ExportModule } from './export/export.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
    }),
    // Rate limiting available for specific controllers via @Throttle() decorator
    ThrottlerModule.forRoot([{ name: 'auth', ttl: 60000, limit: 10 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...createPostgresDataSource(config),
        autoLoadEntities: true,
      }),
    }),
    CommonModule,
    // Auth domain
    AuthModule,
    UsersModule,
    RbacModule,
    MasterDataModule,
    VskModule,
    HomeModule,
    GalleryModule,
    // Grievance domain
    GrievanceModule,
    CategoriesModule,
    GrievanceAttachmentsModule,
    // Forms domain
    FormsModule,
    QuestionsModule,
    ResponsesModule,
    ExportModule,
  ],
})
export class AppModule {}

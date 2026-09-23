import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PortalUser } from './entities/portal-user.entity';
import { PasswordResetOtp } from './entities/password-reset-otp.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import {
  PASSWORD_RESET_NOTIFIER,
  SmtpPasswordResetNotifier,
} from './password-reset-notifier';
import { TokenService } from './jwt.service';
import { RbacModule } from '../rbac/rbac.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PortalUser, PasswordResetOtp]),
    NotificationModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { algorithm: 'HS256' as const },
      }),
      inject: [ConfigService],
    }),
    RbacModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordResetService,
    TokenService,
    // Forgot-password OTP delivery via direct SMTP (this feature's own mailer).
    { provide: PASSWORD_RESET_NOTIFIER, useClass: SmtpPasswordResetNotifier },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}

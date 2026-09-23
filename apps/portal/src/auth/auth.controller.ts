import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import {
  Public,
  Roles,
  CurrentUser,
  AuthenticatedUser,
  AppException,
} from '@rvsk/common';
import { AuthService, UserResponse, ProfileResponse } from './auth.service';
import {
  PasswordResetService,
  GenericAck,
  VerifyOtpResult,
} from './password-reset.service';
import { TokenService } from './jwt.service';
import {
  LoginDto,
  LoginResponse,
  RefreshTokenDto,
  ChangePasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  RequestOtpDto,
  VerifyOtpDto,
  ResendOtpDto,
  ResetWithTokenDto,
} from './dto';

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
    private readonly tokenService: TokenService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() request: LoginDto): Promise<LoginResponse> {
    return this.authService.login(request);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() request: RefreshTokenDto): Promise<LoginResponse> {
    return this.authService.refreshToken(request);
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changePassword(user.username, dto);
  }

  @Roles('Super_Admin', 'RVSK_Admin')
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto);
  }

  // ==================== Forgot-password OTP (RVSK-AUTH-PWDRESET-004) ====================
  // All public + rate-limited. Backend is authoritative for expiry, cooldown,
  // attempt-cap and single-use; request/resend are anti-enumeration.

  @Public()
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @Post('forgot-password/request-otp')
  @HttpCode(200)
  async requestOtp(@Body() dto: RequestOtpDto): Promise<GenericAck> {
    return this.passwordResetService.requestOtp(dto);
  }

  @Public()
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  @Post('forgot-password/verify-otp')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<VerifyOtpResult> {
    return this.passwordResetService.verifyOtp(dto);
  }

  @Public()
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @Post('forgot-password/resend-otp')
  @HttpCode(200)
  async resendOtp(@Body() dto: ResendOtpDto): Promise<GenericAck> {
    return this.passwordResetService.resendOtp(dto);
  }

  @Public()
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  @Post('forgot-password/reset')
  @HttpCode(200)
  async resetWithToken(@Body() dto: ResetWithTokenDto): Promise<void> {
    return this.passwordResetService.reset(dto);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.authService.logout(user.username);
  }

  @Get('me')
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    return this.authService.getCurrentUser(user.username);
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponse> {
    return this.authService.getProfile(user.username);
  }

  @Put('profile')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    return this.authService.updateProfile(user.username, dto);
  }

  @Put('complete-profile')
  async completeProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto & { newPassword?: string },
  ): Promise<ProfileResponse> {
    // Update profile fields
    const profile = await this.authService.updateProfile(user.username, dto);
    // If new password provided, change it (first-login flow: skip the
    // current-password check since the user is setting it for the first time).
    if (dto.newPassword) {
      await this.authService.changePassword(
        user.username,
        { oldPassword: '', newPassword: dto.newPassword } as any,
        true, // skipOldPasswordCheck — first-login bypass
      );
    }
    return profile;
  }

  @Public()
  @Post('validate')
  @HttpCode(200)
  async validate(@Body() body: { token: string }): Promise<UserResponse> {
    try {
      const username = this.tokenService.extractUsername(body.token);
      return this.authService.getCurrentUser(username);
    } catch {
      throw new AppException(
        'Invalid or expired token',
        HttpStatus.UNAUTHORIZED,
        'INVALID_TOKEN',
      );
    }
  }
}

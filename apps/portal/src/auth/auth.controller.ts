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
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  Public,
  Roles,
  CurrentUser,
  AuthenticatedUser,
  AppException,
} from '@rvsk/common';
import { AuthService, UserResponse, ProfileResponse } from './auth.service';
import { TokenService } from './jwt.service';
import {
  LoginDto,
  LoginResponse,
  RefreshTokenDto,
  ChangePasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto';

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
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
    // If new password provided, change it (marks first login complete)
    if (dto.newPassword) {
      await this.authService.changePassword(user.username, {
        oldPassword: '', // first login bypass — service should handle
        newPassword: dto.newPassword,
      } as any);
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

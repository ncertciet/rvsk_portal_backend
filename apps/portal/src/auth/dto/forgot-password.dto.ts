import {
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

/**
 * RVSK-AUTH-PWDRESET-004 — DTOs for the OTP-based password recovery flow.
 * The global ValidationPipe ({ whitelist: true, transform: true }) strips
 * unknown fields and coerces types.
 */

/** Step 1: request an OTP for a registered username. */
export class RequestOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;
}

/** Step 2: verify the OTP delivered to the user's email. */
export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;

  @IsString()
  @IsNotEmpty()
  // 4–10 digits keeps the DTO tolerant of the configurable OTP_LENGTH.
  @Length(4, 10)
  otp: string;
}

/** Resend an OTP (subject to the server-side cooldown). */
export class ResendOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  username: string;
}

/** Step 3: set a new password using the reset session token from Step 2. */
export class ResetWithTokenDto {
  @IsString()
  @IsNotEmpty()
  resetToken: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}

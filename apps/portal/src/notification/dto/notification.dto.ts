import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Update a single event's config (any subset of fields). */
export class UpdateNotificationConfigDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  recipientType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipientValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bcc?: string;

  @IsOptional()
  @IsString()
  subjectTemplate?: string;

  @IsOptional()
  @IsString()
  bodyTemplate?: string;

  @IsOptional()
  @IsString()
  textTemplate?: string;
}

export class TestSendDto {
  @IsEmail()
  toEmail: string;
}

export class UpdateEmailLayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brandName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  headerHtml?: string;

  @IsOptional()
  @IsString()
  footerHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  supportEmail?: string;
}

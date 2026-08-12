import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';

export class VskProfileDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  stateCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  facilitatedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  otherSchemeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  step1Status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  step2Status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  step3Status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  step4Status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  submissionStatus?: string;

  @IsOptional()
  @IsBoolean()
  declarationCertified?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

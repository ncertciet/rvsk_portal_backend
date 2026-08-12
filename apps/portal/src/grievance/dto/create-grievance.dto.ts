import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGrievanceDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  subCategory?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;
}

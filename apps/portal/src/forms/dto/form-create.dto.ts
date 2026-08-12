import { IsNotEmpty, IsOptional, IsString, MaxLength, IsDateString } from 'class-validator';

export class FormCreateDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

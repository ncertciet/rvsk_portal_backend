import { IsOptional, IsString, IsNumber, MaxLength } from 'class-validator';

export class VskInfraDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  stateCode?: string;

  @IsOptional()
  @IsNumber()
  roomLength?: number;

  @IsOptional()
  @IsNumber()
  roomWidth?: number;

  @IsOptional()
  @IsNumber()
  roomHeight?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  roomImageUrl?: string;

  @IsOptional()
  @IsNumber()
  screenLength?: number;

  @IsOptional()
  @IsNumber()
  screenHeight?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  screenImageUrl?: string;

  @IsOptional()
  @IsNumber()
  workstationCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  workstationImageUrl?: string;
}

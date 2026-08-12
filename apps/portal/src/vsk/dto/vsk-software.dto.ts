import { IsOptional, IsString, IsBoolean, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class SoftwareItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  softwareName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  customSoftwareName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  softwareType?: string;
}

export class VskSoftwareDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  stateCode?: string;

  @IsOptional()
  @IsBoolean()
  starterPack?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serverType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SoftwareItemDto)
  items?: SoftwareItemDto[];
}

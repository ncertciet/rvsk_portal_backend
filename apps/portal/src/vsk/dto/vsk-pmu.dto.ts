import { IsOptional, IsString, IsNumber, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class PmuRoleDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  roleName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  customRoleName?: string;

  @IsOptional()
  @IsNumber()
  noOfMembers?: number;
}

export class VskPmuDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  stateCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pmuTeamType?: string;

  @IsOptional()
  @IsNumber()
  totalTeamMembers?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PmuRoleDto)
  roles?: PmuRoleDto[];
}

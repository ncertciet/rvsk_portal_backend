import { IsOptional, IsString, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Normalize a truthy/falsy flag coming from the client.
 * The frontend sends starterPack as 1/0 (number); older callers may send
 * true/false or "true"/"false". Coerce all of these to a real boolean so the
 * boolean DB column is populated correctly.
 */
function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }
  return undefined;
}

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

  // On input, coerced to a real boolean (frontend sends 1/0). On output, the
  // service emits 1/0 so the frontend's `starterPack === 1` check works.
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  starterPack?: boolean | number;

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

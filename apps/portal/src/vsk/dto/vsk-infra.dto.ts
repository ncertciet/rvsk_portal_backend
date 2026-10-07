import { IsOptional, IsString, IsNumber, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Skip validation when the value is null OR undefined. The wizard sends `null`
 * for cleared numeric fields, and plain @IsOptional()/@IsNumber() combinations
 * have rejected `null` in some class-validator versions — ValidateIf makes the
 * "optional, nullable" intent explicit and version-proof.
 */
const Nullable = () => ValidateIf((_obj, value) => value !== null && value !== undefined);

const Numeric = () => Transform(({ value }) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  { toClassOnly: true },
);

export class VskInfraDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  stateCode?: string;

  @Nullable()
  @Numeric()
  @IsNumber()
  roomLength?: number | null;

  @Nullable()
  @Numeric()
  @IsNumber()
  roomWidth?: number | null;

  @Nullable()
  @Numeric()
  @IsNumber()
  roomHeight?: number | null;

  @Nullable()
  @IsString()
  @MaxLength(500)
  roomImageUrl?: string | null;

  @Nullable()
  @Numeric()
  @IsNumber()
  screenLength?: number | null;

  @Nullable()
  @Numeric()
  @IsNumber()
  screenHeight?: number | null;

  @Nullable()
  @IsString()
  @MaxLength(500)
  screenImageUrl?: string | null;

  @Nullable()
  @Numeric()
  @IsNumber()
  workstationCount?: number | null;

  @Nullable()
  @IsString()
  @MaxLength(500)
  workstationImageUrl?: string | null;
}

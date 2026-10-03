import { IsOptional, IsString, IsNumber, MaxLength, ValidateIf } from 'class-validator';

/**
 * Skip validation when the value is null OR undefined. The wizard sends `null`
 * for cleared numeric fields, and plain @IsOptional()/@IsNumber() combinations
 * have rejected `null` in some class-validator versions — ValidateIf makes the
 * "optional, nullable" intent explicit and version-proof.
 */
const Nullable = () => ValidateIf((_obj, value) => value !== null && value !== undefined);

export class VskInfraDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  stateCode?: string;

  @Nullable()
  @IsNumber()
  roomLength?: number | null;

  @Nullable()
  @IsNumber()
  roomWidth?: number | null;

  @Nullable()
  @IsNumber()
  roomHeight?: number | null;

  @Nullable()
  @IsString()
  @MaxLength(500)
  roomImageUrl?: string | null;

  @Nullable()
  @IsNumber()
  screenLength?: number | null;

  @Nullable()
  @IsNumber()
  screenHeight?: number | null;

  @Nullable()
  @IsString()
  @MaxLength(500)
  screenImageUrl?: string | null;

  @Nullable()
  @IsNumber()
  workstationCount?: number | null;

  @Nullable()
  @IsString()
  @MaxLength(500)
  workstationImageUrl?: string | null;
}

import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayNotEmpty,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Assign one or more States to a SPOC (also used for reassignment — any State
 * already owned by a different SPOC is transparently reassigned).
 *
 * Note: portal_users.id is a `uuid` column but holds non-RFC-4122 GUIDs (Oracle
 * SYS_GUID lineage), so we validate it as a non-empty string rather than
 * @IsUUID(). The service still verifies the user exists and is an RVSK_SPOC.
 */
export class AssignStatesDto {
  @IsString()
  @IsNotEmpty()
  spocUserId: string;

  @IsArray()
  @ArrayNotEmpty()
  @Matches(/^\d+$/, { each: true, message: 'each state key must be a numeric string' })
  stateKeys: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/** Reassign a single State to a SPOC (UI convenience over AssignStatesDto). */
export class ReassignStateDto {
  @Matches(/^\d+$/, { message: 'state key must be a numeric string' })
  stateKey: string;

  @IsString()
  @IsNotEmpty()
  spocUserId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/** Deactivate (retire) a State's active mapping. */
export class DeactivateStateDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

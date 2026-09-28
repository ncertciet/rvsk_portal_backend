import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Common Page-1 filter params (design.md §6.1). All optional; the geo keys are
 * numeric ..._KEY strings (aligned with JWT claims). Effective scope overrides
 * conflicting inbound keys server-side (scope.util.applyScope).
 */
export class AttendanceFiltersDto {
  /** Snapshot date YYYY-MM-DD; defaults to the latest available date. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional() @IsString() stateKey?: string;
  @IsOptional() @IsString() districtKey?: string;
  @IsOptional() @IsString() blockKey?: string;
  @IsOptional() @IsString() clusterKey?: string;
  @IsOptional() @IsString() udiseCode?: string;
}

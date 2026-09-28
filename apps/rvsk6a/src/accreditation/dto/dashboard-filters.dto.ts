import { IsOptional, IsString, Matches } from 'class-validator';

export class DashboardFiltersDto {
  /**
   * ADW state surrogate key (NUMBER as string), sourced from VW_STATE_MASTER
   * and carried by the JWT — the SAME key the generic dashboard filter and the
   * attendance dashboard use. 'ALL' (or omitted) means national aggregation.
   *
   * The accreditation MVs are keyed on the business state_code, so the service
   * translates stateKey -> state_code via VW_STATE_MASTER at query time.
   */
  @IsOptional()
  @IsString()
  stateKey?: string = 'ALL';

  // Accept both YYYY-YY (e.g. 2025-26) and YYYY-YYYY (e.g. 2025-2026),
  // since ADW year_code may use either convention.
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}(\d{2})?$/, {
    message: 'academicYear must be format YYYY-YY or YYYY-YYYY (e.g. 2025-26 or 2025-2026)',
  })
  academicYear?: string;
}

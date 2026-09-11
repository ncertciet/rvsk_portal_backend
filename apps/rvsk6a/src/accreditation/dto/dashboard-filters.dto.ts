import { IsOptional, IsString, Matches } from 'class-validator';

export class DashboardFiltersDto {
  @IsOptional()
  @IsString()
  stateCode?: string = 'ALL';

  // Accept both YYYY-YY (e.g. 2025-26) and YYYY-YYYY (e.g. 2025-2026),
  // since ADW year_code may use either convention.
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}(\d{2})?$/, {
    message: 'academicYear must be format YYYY-YY or YYYY-YYYY (e.g. 2025-26 or 2025-2026)',
  })
  academicYear?: string;
}

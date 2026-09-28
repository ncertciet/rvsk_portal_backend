import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

/**
 * Page-2 (Trends) query params (design.md §15.2). The date range is either a
 * preset (`range`) or a custom `fromDate`/`toDate`. Custom ranges are
 * hard-clamped to the last N months server-side (see AttendanceTrendsService) —
 * the client bound is never trusted.
 */
export const TREND_RANGES = ['30D', '3M', '6M'] as const;
export type TrendRange = (typeof TREND_RANGES)[number];

export const TREND_DIMENSIONS = ['overall', 'class', 'gender', 'category'] as const;
export type TrendDimensionParam = (typeof TREND_DIMENSIONS)[number];

export class AttendanceTrendDto {
  /** Preset range; ignored when fromDate/toDate are supplied. */
  @IsOptional()
  @IsIn(TREND_RANGES)
  range?: TrendRange;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'toDate must be YYYY-MM-DD' })
  toDate?: string;

  /** Which breakdown to return; default 'overall' (split/lazy per design §15.2). */
  @IsOptional()
  @IsIn(TREND_DIMENSIONS)
  dimension?: TrendDimensionParam;

  // Geo scope (same as filters).
  @IsOptional() @IsString() stateKey?: string;
  @IsOptional() @IsString() districtKey?: string;
  @IsOptional() @IsString() blockKey?: string;
  @IsOptional() @IsString() clusterKey?: string;
  @IsOptional() @IsString() udiseCode?: string;
}

/**
 * Frozen Page-1 & Page-2 response `data` contracts (design.md §15). These mirror
 * the frontend mock shapes (attendanceMockData.ts) exactly and are the stable
 * boundary both sides code against.
 */

// ── Shared ────────────────────────────────────────────────────────────────────
export interface HeadcountTriple {
  schools: number;
  teachers: number;
  students: number;
}

// ── Page 1 — Attendance summary ────────────────────────────────────────────────
export interface CoveragePair {
  reported: number;
  expected: number;
}

export interface IntegrationCoverage {
  states: CoveragePair;
  districts: CoveragePair;
  blocks: CoveragePair;
}

export interface UdiseRef extends HeadcountTriple {
  grain: 'NATIONAL' | 'STATE' | null;
}

export interface IntegrationStatus {
  /** null below State (UDISE static ref is All-India/State grain only). */
  udiseRef: UdiseRef | null;
  rvskMaster: HeadcountTriple;
  onboarded: HeadcountTriple;
  yetToOnboard: HeadcountTriple;
}

export interface SchoolIntegration {
  onboarded: number;
  reportingTeacher: number;
  reportingStudent: number;
}

export interface TeacherBlock {
  totalInSchools: number;
  totalReported: number;
  reportedPct: number;
  present: number;
  absent: number;
  onDuty: number;
  presentPct: number;
  absentPct: number;
  onDutyPct: number;
}

export interface StudentBlock {
  totalInSchools: number;
  totalReported: number;
  reportedPct: number;
  present: number;
  absent: number;
  presentPct: number;
  absentPct: number;
}

export interface AttendancePageData {
  asOfDate: string;
  scopeLevel: 'national' | 'state' | 'district';
  integrationCoverage: IntegrationCoverage;
  integrationStatus: IntegrationStatus;
  schoolIntegration: SchoolIntegration;
  teacher: TeacherBlock;
  student: StudentBlock;
}

// ── Page 2 — Trends ─────────────────────────────────────────────────────────────
/** One reported (participation %) point: teacher & student on the same date. */
export interface ReportedPoint {
  period: string;
  teacher: number;
  student: number;
}

/** One present (%) point for the "overall" series: teacher & student. */
export interface OverallPresentPoint {
  period: string;
  teacher: number;
  student: number;
}

/** One value point for a single dimensioned series (class/gender/category). */
export interface ValuePoint {
  period: string;
  value: number;
}

export type TrendGranularity = 'daily' | 'weekly';
export type TrendDimension = 'overall' | 'class' | 'gender' | 'category';

export interface TrendPresent {
  overall?: OverallPresentPoint[];
  byClass?: Record<string, ValuePoint[]>;
  byGender?: Record<'male' | 'female' | 'others', ValuePoint[]>;
  byCategory?: Record<'general' | 'sc' | 'st' | 'obc', ValuePoint[]>;
}

export interface TrendData {
  granularity: TrendGranularity;
  range: string;
  reported: ReportedPoint[];
  present: TrendPresent;
}

// ── Internal: the per-node daily-series blob stored in Redis (att:v1:series:*) ──
/**
 * The cron stores, per node, a ~6-month array of daily RAW COUNTS (not %), so
 * the API can re-bucket weekly correctly (weighted). One blob per dimension.
 */
export interface DailyCountPoint {
  d: string; // YYYY-MM-DD
  present: number;
  absent: number;
}

export interface TeacherDailyPoint {
  d: string;
  marked: number;
  present: number;
  reportingSchools: number;
  activeSchools: number;
}

export interface StudentReportedDailyPoint {
  d: string;
  reportingSchools: number;
  activeSchools: number;
}

/** att:v1:series:{level}:{key}:student:overall + reported context. */
export interface StudentOverallSeriesBlob {
  present: DailyCountPoint[]; // present/absent per day (overall students)
  reported: StudentReportedDailyPoint[]; // reporting/active schools per day
}

/** att:v1:series:{level}:{key}:teacher */
export interface TeacherSeriesBlob {
  daily: TeacherDailyPoint[];
}

/** att:v1:series:{level}:{key}:student:class|gender|category */
export interface DimensionSeriesBlob {
  series: Record<string, DailyCountPoint[]>; // keyed by class no. / gender / category
}

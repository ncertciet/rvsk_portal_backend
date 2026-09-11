/**
 * Response interfaces and KPI envelope types for the Accreditation Dashboard.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

export interface DashboardFilters {
  stateCode?: string; // default: 'ALL'
  academicYear?: string; // default: current active year
}

export interface KpiEnvelope<T> {
  kpi_no: number | number[];
  title: string;
  as_of: string; // ISO 8601 timestamp
  filters: DashboardFilters;
  data: T;
  status: 'OK';
}

export interface ProgrammeFrameworkResponse {
  kpi_1: {
    states_with_programme: number;
    total_states: number;
  };
  kpi_2: {
    states_with_authority: number;
    authorities: Array<{ state_code: string; authority_name: string }>;
  };
  kpi_3: {
    models: Array<{ label: string; state_count: number; school_count: number }>;
  };
}

export interface CoverageReachResponse {
  kpi_4: {
    total_schools_accredited: number;
    by_state: Array<{ state_code: string; schools_accredited: number }>;
  };
  kpi_5: {
    round_distribution: {
      round_1: number;
      round_2: number;
      round_3_plus: number;
    };
    avg_rounds: number;
  };
  kpi_6: {
    national_coverage_pct: number;
    by_state: Array<{
      state_code: string;
      coverage_pct: number;
      tier: 'HIGH' | 'MEDIUM' | 'LOW';
    }>;
  };
}

export interface ProcessOperationsResponse {
  kpi_7: {
    frequency_distribution: Array<{ label: string; state_count: number }>;
  };
  kpi_8: {
    visit_coverage_pct: number;
    visited_schools: number;
    total_accredited: number;
  };
  kpi_9: {
    authority_participation: Record<string, number>;
  };
  kpi_10: {
    states_with_vsk: number;
    states: Array<{ state_code: string; state_name: string }>;
  };
}

export interface DomainComponentsResponse {
  kpi_11: {
    domains_assessed: Array<{
      domain_code: string;
      domain_name: string;
      states_assessing: number;
    }>;
  };
  kpi_12: {
    domain_scores: Array<{
      domain_code: string;
      domain_name: string;
      avg_score: number;
      weightage: number;
    }>;
  };
}

export interface DataQualityResponse {
  kpi_13: {
    self_disclosure_pct: number;
    schools_submitted: number;
    total_schools: number;
  };
  kpi_14: {
    on_time_pct: number;
    delayed_pct: number;
    significantly_delayed_pct: number;
    avg_delay_days: number;
  };
}

export interface ImpactOutcomesResponse {
  kpi_15: {
    decision_use_cases: Record<string, { count: number; states: string[] }>;
  };
  kpi_16: {
    pct_schools_improved: number;
    schools_improved: number;
    schools_with_prior: number;
    avg_score_change: number;
  };
  kpi_17: {
    sharing_distribution: Array<{ label: string; state_count: number }>;
  };
}

export interface RefreshResult {
  refreshed: boolean;
  timestamp?: string;
  reason?: string;
}

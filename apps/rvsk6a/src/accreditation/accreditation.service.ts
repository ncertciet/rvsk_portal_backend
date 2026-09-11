import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';
import {
  KpiEnvelope,
  ProgrammeFrameworkResponse,
  CoverageReachResponse,
  ProcessOperationsResponse,
  DomainComponentsResponse,
  DataQualityResponse,
  ImpactOutcomesResponse,
  RefreshResult,
} from './interfaces';

/**
 * Row shape returned from mv_dash_programme_framework
 */
interface MvProgrammeFrameworkRow {
  state_code: string;
  academic_year: string;
  programme_active: boolean;
  school_standard_authority: boolean;
  school_standard_authority_name: string | null;
  accreditation_model_label: string | null;
  schools_on_this_model: number;
}

/**
 * Row shape returned from mv_dash_coverage_reach
 */
interface MvCoverageReachRow {
  state_code: string;
  academic_year: string;
  schools_accredited: number;
  total_schools: number;
  coverage_pct: number;
  coverage_tier: 'HIGH' | 'MEDIUM' | 'LOW';
  round_1: number;
  round_2: number;
  round_3_plus: number;
  avg_rounds_per_school: number;
}

/**
 * Row shape returned from mv_dash_process_operations
 */
interface MvProcessOperationsRow {
  state_code: string;
  state_name: string;
  academic_year: string;
  total_accredited_schools: number;
  visited_schools: number;
  visit_coverage_pct: number;
  pct_state_official: number;
  pct_district_official: number;
  pct_block_official: number;
  pct_cluster_official: number;
  pct_community_members: number;
  pct_third_party_auditors: number;
}

/**
 * Row shape returned from mv_dash_programme_framework (for KPI 7 and KPI 10 queries)
 */
interface MvProgrammeFrameworkFrequencyRow {
  state_code: string;
  state_name: string;
  accreditation_frequency: string | null;
  integration_of_vsk: boolean;
}

/**
 * Row shape returned from mv_dash_domain_components
 */
interface MvDomainComponentsRow {
  academic_year: string;
  domain_code: string;
  domain_name: string;
  domain_weightage: number;
  states_assessing: number;
  avg_score: number;
}

/**
 * Row shape returned from mv_dash_data_quality
 */
interface MvDataQualityRow {
  state_code: string;
  academic_year: string;
  schools_submitted: number;
  total_schools: number;
  self_disclosure_pct: number;
  on_time_pct: number;
  delayed_pct: number;
  significantly_delayed_pct: number;
  avg_delay_days: number;
}

@Injectable()
export class AccreditationService {
  /** Oracle ADW schema holding the accreditation MVs and reference tables. */
  private readonly accrSchema: string;

  constructor(
    // Default (Oracle ADW) DataSource — same as AttendanceService.
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    // Configurable via ACCR_SCHEMA in .env.local; falls back to the ADW schema.
    this.accrSchema = this.configService.get<string>('ACCR_SCHEMA', 'RTIWARI');
  }

  /**
   * Resolves the current active academic year from the database.
   * Used as fallback when no academicYear filter is provided.
   */
  async getCurrentYear(): Promise<string> {
    // ADW has no dedicated academic_years table, so the year list is derived
    // from the dashboard MVs themselves (guarantees the dropdown only shows
    // years that actually have data). "Current" = the most recent year.
    const result = await this.dataSource.query(
      `SELECT academic_year
       FROM ${this.accrSchema}.mv_dash_coverage_reach
       WHERE academic_year IS NOT NULL
       GROUP BY academic_year
       ORDER BY academic_year DESC
       FETCH FIRST 1 ROWS ONLY`,
    );
    if (result.length === 0) {
      throw new Error(`No academic year data found in ${this.accrSchema} dashboard views`);
    }
    return result[0].academic_year ?? result[0].ACADEMIC_YEAR;
  }

  /**
   * Fetches Programme Infrastructure & Framework KPIs (1, 2, 3).
   *
   * KPI 1: Count of distinct states with an active accreditation programme
   * KPI 2: List of states with a school standard authority and their authority names
   * KPI 3: Accreditation model distribution (label, state count, school count)
   *
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 3.1, 3.2, 3.3, 3.4, 3.5
   */
  async getProgrammeFramework(
    filters: DashboardFiltersDto,
  ): Promise<KpiEnvelope<ProgrammeFrameworkResponse>> {
    const academicYear = filters.academicYear || (await this.getCurrentYear());
    const stateCode = filters.stateCode || 'ALL';

    // Build query with optional state_code filter.
    // Oracle returns unquoted identifiers UPPERCASE, so every column is aliased
    // with a quoted lower_snake_case name matching the row interface.
    let query = `SELECT state_code            AS "state_code",
                        academic_year         AS "academic_year",
                        programme_active      AS "programme_active",
                        school_standard_authority AS "school_standard_authority",
                        school_standard_authority_name AS "school_standard_authority_name",
                        accreditation_model_label AS "accreditation_model_label",
                        schools_on_this_model AS "schools_on_this_model"
                 FROM ${this.accrSchema}.mv_dash_programme_framework
                 WHERE academic_year = :1`;
    const params: (string | number)[] = [academicYear];

    if (stateCode !== 'ALL') {
      query += ` AND state_code = :2`;
      params.push(stateCode);
    }

    const rows: MvProgrammeFrameworkRow[] = await this.dataSource.query(query, params);

    // KPI 1: Count distinct state_codes where programme_active = true
    const activeStates = new Set(
      rows.filter((r) => r.programme_active).map((r) => r.state_code),
    );

    // KPI 2: States with school_standard_authority = true, with authority names
    const authorityMap = new Map<string, string>();
    for (const row of rows) {
      if (row.school_standard_authority && row.school_standard_authority_name) {
        authorityMap.set(row.state_code, row.school_standard_authority_name);
      }
    }
    const authorities = Array.from(authorityMap.entries()).map(
      ([state_code, authority_name]) => ({ state_code, authority_name }),
    );

    // KPI 3: Group by accreditation_model_label, sum schools_on_this_model, count distinct states
    const modelMap = new Map<
      string,
      { school_count: number; states: Set<string> }
    >();
    for (const row of rows) {
      if (row.accreditation_model_label) {
        const existing = modelMap.get(row.accreditation_model_label);
        if (existing) {
          existing.school_count += Number(row.schools_on_this_model) || 0;
          existing.states.add(row.state_code);
        } else {
          modelMap.set(row.accreditation_model_label, {
            school_count: Number(row.schools_on_this_model) || 0,
            states: new Set([row.state_code]),
          });
        }
      }
    }
    const models = Array.from(modelMap.entries()).map(
      ([label, { school_count, states }]) => ({
        label,
        state_count: states.size,
        school_count,
      }),
    );

    return {
      kpi_no: [1, 2, 3],
      title: 'Programme Infrastructure & Framework',
      as_of: new Date().toISOString(),
      filters: {
        stateCode: stateCode,
        academicYear: academicYear,
      },
      data: {
        kpi_1: {
          states_with_programme: activeStates.size,
          total_states: 36,
        },
        kpi_2: {
          states_with_authority: authorities.length,
          authorities,
        },
        kpi_3: {
          models,
        },
      },
      status: 'OK',
    };
  }

  /**
   * Coverage & Reach KPIs (4, 5, 6).
   *
   * KPI 4: Schools accredited per state + national total
   * KPI 5: Round distribution (round 1, round 2, round 3+) + average rounds per school
   * KPI 6: Coverage percentage and tier classification per state + national coverage
   *
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
   */
  async getCoverageReach(
    filters: DashboardFiltersDto,
  ): Promise<KpiEnvelope<CoverageReachResponse>> {
    const academicYear = filters.academicYear || (await this.getCurrentYear());
    const stateCode = filters.stateCode || 'ALL';

    // Build query with optional state_code filter
    let query = `SELECT state_code            AS "state_code",
                        academic_year         AS "academic_year",
                        schools_accredited    AS "schools_accredited",
                        total_schools         AS "total_schools",
                        coverage_pct          AS "coverage_pct",
                        coverage_tier         AS "coverage_tier",
                        round_1               AS "round_1",
                        round_2               AS "round_2",
                        round_3_plus          AS "round_3_plus",
                        avg_rounds_per_school AS "avg_rounds_per_school"
                 FROM ${this.accrSchema}.mv_dash_coverage_reach
                 WHERE academic_year = :1`;
    const params: (string | number)[] = [academicYear];

    if (stateCode !== 'ALL') {
      query += ` AND state_code = :2`;
      params.push(stateCode);
    }

    const rows: MvCoverageReachRow[] = await this.dataSource.query(query, params);

    // KPI 4: Total schools accredited (national sum) + breakdown by state
    const totalAccredited = rows.reduce(
      (sum, r) => sum + Number(r.schools_accredited),
      0,
    );

    // KPI 5: Round distribution (national sums) + average rounds per school
    const totalRound1 = rows.reduce((sum, r) => sum + Number(r.round_1), 0);
    const totalRound2 = rows.reduce((sum, r) => sum + Number(r.round_2), 0);
    const totalRound3Plus = rows.reduce(
      (sum, r) => sum + Number(r.round_3_plus),
      0,
    );
    const avgRounds =
      rows.length > 0
        ? rows.reduce((sum, r) => sum + Number(r.avg_rounds_per_school), 0) /
          rows.length
        : 0;

    // KPI 6: National coverage % + per-state coverage with tier (tier comes from MV)
    const totalSchools = rows.reduce(
      (sum, r) => sum + Number(r.total_schools),
      0,
    );
    const nationalCoveragePct =
      totalSchools > 0
        ? Math.round((totalAccredited / totalSchools) * 1000) / 10
        : 0;

    return {
      kpi_no: [4, 5, 6],
      title: 'Coverage & Reach',
      as_of: new Date().toISOString(),
      filters: {
        stateCode,
        academicYear,
      },
      data: {
        kpi_4: {
          total_schools_accredited: totalAccredited,
          by_state: rows.map((r) => ({
            state_code: r.state_code,
            schools_accredited: Number(r.schools_accredited),
          })),
        },
        kpi_5: {
          round_distribution: {
            round_1: totalRound1,
            round_2: totalRound2,
            round_3_plus: totalRound3Plus,
          },
          avg_rounds: Math.round(avgRounds * 100) / 100,
        },
        kpi_6: {
          national_coverage_pct: nationalCoveragePct,
          by_state: rows.map((r) => ({
            state_code: r.state_code,
            coverage_pct: Number(r.coverage_pct),
            tier: r.coverage_tier,
          })),
        },
      },
      status: 'OK',
    };
  }

  /**
   * Domain Components KPIs (11, 12).
   *
   * KPI 11: Domains assessed with number of states assessing each domain
   * KPI 12: Domain-level average scores and weightages
   *
   * Note: mv_dash_domain_components does not have state_code as a filter column;
   * it aggregates across states. Only academic_year is used as a filter.
   *
   * Validates: Requirements 6.5, 6.6
   */
  async getDomainComponents(
    filters: DashboardFiltersDto,
  ): Promise<KpiEnvelope<DomainComponentsResponse>> {
    const academicYear = filters.academicYear || (await this.getCurrentYear());

    const rows: MvDomainComponentsRow[] = await this.dataSource.query(
      `SELECT domain_code      AS "domain_code",
              domain_name      AS "domain_name",
              domain_weightage AS "domain_weightage",
              states_assessing AS "states_assessing",
              avg_score        AS "avg_score"
       FROM ${this.accrSchema}.mv_dash_domain_components
       WHERE academic_year = :1`,
      [academicYear],
    );

    // KPI 11: Domains assessed with state assessment counts
    const domainsAssessed = rows.map((r) => ({
      domain_code: r.domain_code,
      domain_name: r.domain_name,
      states_assessing: Number(r.states_assessing),
    }));

    // KPI 12: Domain scores with weightages
    const domainScores = rows.map((r) => ({
      domain_code: r.domain_code,
      domain_name: r.domain_name,
      avg_score: Math.round(Number(r.avg_score) * 100) / 100,
      weightage: Number(r.domain_weightage),
    }));

    return {
      kpi_no: [11, 12],
      title: 'Domain Components',
      as_of: new Date().toISOString(),
      filters: {
        stateCode: filters.stateCode || 'ALL',
        academicYear,
      },
      data: {
        kpi_11: {
          domains_assessed: domainsAssessed,
        },
        kpi_12: {
          domain_scores: domainScores,
        },
      },
      status: 'OK',
    };
  }

  /**
   * Process Quality & Operations KPIs (7, 8, 9, 10).
   *
   * KPI 7: Accreditation frequency distribution across states
   * KPI 8: Visit coverage percentage, visited schools, total accredited
   * KPI 9: Authority participation percentages (6 categories)
   * KPI 10: States with VSK integration
   *
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.7, 6.8, 6.9
   */
  async getProcessOperations(
    filters: DashboardFiltersDto,
  ): Promise<KpiEnvelope<ProcessOperationsResponse>> {
    const academicYear = filters.academicYear || (await this.getCurrentYear());
    const stateCode = filters.stateCode || 'ALL';

    // KPI 7 & KPI 10: Query programme framework MV for frequency and VSK data.
    // MV_DASH_PROGRAMME_FRAMEWORK exposes state_code only, so the state name
    // for the VSK list (KPI 10) is resolved via a join to STATE_MASTER.
    let freqQuery = `SELECT pf.state_code              AS "state_code",
                            sm.state_name              AS "state_name",
                            pf.accreditation_frequency AS "accreditation_frequency",
                            pf.integration_of_vsk      AS "integration_of_vsk"
                     FROM ${this.accrSchema}.mv_dash_programme_framework pf
                     LEFT JOIN ${this.accrSchema}.state_master sm
                            ON sm.state_code = pf.state_code
                     WHERE pf.academic_year = :1`;
    const freqParams: (string | number)[] = [academicYear];
    if (stateCode !== 'ALL') {
      freqQuery += ` AND pf.state_code = :2`;
      freqParams.push(stateCode);
    }
    const freqRows: MvProgrammeFrameworkFrequencyRow[] = await this.dataSource.query(
      freqQuery,
      freqParams,
    );

    // KPI 7: Group states by accreditation_frequency label
    const frequencyMap = new Map<string, Set<string>>();
    for (const row of freqRows) {
      const label = row.accreditation_frequency || 'Not Specified';
      const existing = frequencyMap.get(label);
      if (existing) {
        existing.add(row.state_code);
      } else {
        frequencyMap.set(label, new Set([row.state_code]));
      }
    }
    const frequencyDistribution = Array.from(frequencyMap.entries()).map(
      ([label, states]) => ({ label, state_count: states.size }),
    );

    // KPI 10: States with VSK integration
    const vskStates = new Map<string, string>();
    for (const row of freqRows) {
      if (row.integration_of_vsk) {
        vskStates.set(row.state_code, row.state_name);
      }
    }
    const vskStatesList = Array.from(vskStates.entries()).map(
      ([state_code, state_name]) => ({ state_code, state_name }),
    );

    // KPI 8 & KPI 9: Query process operations MV
    let opsQuery = `SELECT state_code               AS "state_code",
                           total_accredited_schools AS "total_accredited_schools",
                           visited_schools          AS "visited_schools",
                           visit_coverage_pct       AS "visit_coverage_pct",
                           pct_state_official       AS "pct_state_official",
                           pct_district_official    AS "pct_district_official",
                           pct_block_official       AS "pct_block_official",
                           pct_cluster_official     AS "pct_cluster_official",
                           pct_community_members    AS "pct_community_members",
                           pct_third_party_auditors AS "pct_third_party_auditors"
                    FROM ${this.accrSchema}.mv_dash_process_operations
                    WHERE academic_year = :1`;
    const opsParams: (string | number)[] = [academicYear];
    if (stateCode !== 'ALL') {
      opsQuery += ` AND state_code = :2`;
      opsParams.push(stateCode);
    }
    const opsRows: MvProcessOperationsRow[] = await this.dataSource.query(
      opsQuery,
      opsParams,
    );

    // KPI 8: Visit coverage — aggregate across states
    const totalAccredited = opsRows.reduce(
      (sum, r) => sum + Number(r.total_accredited_schools),
      0,
    );
    const totalVisited = opsRows.reduce(
      (sum, r) => sum + Number(r.visited_schools),
      0,
    );
    const visitCoveragePct =
      totalAccredited > 0
        ? Math.min(100, Math.round((totalVisited / totalAccredited) * 1000) / 10)
        : 0;

    // KPI 9: Average authority participation across states
    const numStates = opsRows.length || 1;
    const authorityParticipation: Record<string, number> = {
      state_official: Math.round(
        opsRows.reduce((sum, r) => sum + Number(r.pct_state_official), 0) / numStates * 100,
      ) / 100,
      district_official: Math.round(
        opsRows.reduce((sum, r) => sum + Number(r.pct_district_official), 0) / numStates * 100,
      ) / 100,
      block_official: Math.round(
        opsRows.reduce((sum, r) => sum + Number(r.pct_block_official), 0) / numStates * 100,
      ) / 100,
      cluster_official: Math.round(
        opsRows.reduce((sum, r) => sum + Number(r.pct_cluster_official), 0) / numStates * 100,
      ) / 100,
      community_members: Math.round(
        opsRows.reduce((sum, r) => sum + Number(r.pct_community_members), 0) / numStates * 100,
      ) / 100,
      third_party_auditors: Math.round(
        opsRows.reduce((sum, r) => sum + Number(r.pct_third_party_auditors), 0) / numStates * 100,
      ) / 100,
    };

    return {
      kpi_no: [7, 8, 9, 10],
      title: 'Process Quality & Operations',
      as_of: new Date().toISOString(),
      filters: { stateCode, academicYear },
      data: {
        kpi_7: { frequency_distribution: frequencyDistribution },
        kpi_8: {
          visit_coverage_pct: visitCoveragePct,
          visited_schools: Math.min(totalVisited, totalAccredited),
          total_accredited: totalAccredited,
        },
        kpi_9: { authority_participation: authorityParticipation },
        kpi_10: {
          states_with_vsk: vskStates.size,
          states: vskStatesList,
        },
      },
      status: 'OK',
    };
  }

  /**
   * Data Quality & Compliance KPIs (13, 14).
   *
   * KPI 13: Self-disclosure percentage, schools submitted, total schools
   * KPI 14: On-time %, delayed %, significantly delayed %, avg delay days
   *
   * Validates: Requirements 7.1, 7.2, 7.3
   */
  async getDataQuality(
    filters: DashboardFiltersDto,
  ): Promise<KpiEnvelope<DataQualityResponse>> {
    const academicYear = filters.academicYear || (await this.getCurrentYear());
    const stateCode = filters.stateCode || 'ALL';

    let query = `SELECT state_code                AS "state_code",
                        schools_submitted         AS "schools_submitted",
                        total_schools             AS "total_schools",
                        self_disclosure_pct       AS "self_disclosure_pct",
                        on_time_pct               AS "on_time_pct",
                        delayed_pct               AS "delayed_pct",
                        significantly_delayed_pct AS "significantly_delayed_pct",
                        avg_delay_days            AS "avg_delay_days"
                 FROM ${this.accrSchema}.mv_dash_data_quality
                 WHERE academic_year = :1`;
    const params: (string | number)[] = [academicYear];
    if (stateCode !== 'ALL') {
      query += ` AND state_code = :2`;
      params.push(stateCode);
    }

    const rows: MvDataQualityRow[] = await this.dataSource.query(query, params);

    // KPI 13: National aggregation of self-disclosure
    const totalSubmitted = rows.reduce(
      (sum, r) => sum + Number(r.schools_submitted),
      0,
    );
    const totalSchools = rows.reduce(
      (sum, r) => sum + Number(r.total_schools),
      0,
    );
    const selfDisclosurePct =
      totalSchools > 0
        ? Math.round((totalSubmitted / totalSchools) * 1000) / 10
        : 0;

    // KPI 14: Average timeliness metrics across states
    const numStates = rows.length || 1;
    const onTimePct = Math.round(
      rows.reduce((sum, r) => sum + Number(r.on_time_pct), 0) / numStates * 100,
    ) / 100;
    const delayedPct = Math.round(
      rows.reduce((sum, r) => sum + Number(r.delayed_pct), 0) / numStates * 100,
    ) / 100;
    const significantlyDelayedPct = Math.round(
      rows.reduce((sum, r) => sum + Number(r.significantly_delayed_pct), 0) / numStates * 100,
    ) / 100;
    const avgDelayDays = Math.round(
      rows.reduce((sum, r) => sum + Number(r.avg_delay_days), 0) / numStates * 100,
    ) / 100;

    return {
      kpi_no: [13, 14],
      title: 'Data Quality & Compliance',
      as_of: new Date().toISOString(),
      filters: { stateCode, academicYear },
      data: {
        kpi_13: {
          self_disclosure_pct: selfDisclosurePct,
          schools_submitted: totalSubmitted,
          total_schools: totalSchools,
        },
        kpi_14: {
          on_time_pct: onTimePct,
          delayed_pct: delayedPct,
          significantly_delayed_pct: significantlyDelayedPct,
          avg_delay_days: avgDelayDays,
        },
      },
      status: 'OK',
    };
  }

  /**
   * Impact/Outcomes & Decision-Making KPIs (15, 16, 17).
   *
   * KPI 15: Decision use cases and associated state counts
   * KPI 16: Improvement metrics (% improved, count improved, count with prior, avg score change)
   * KPI 17: Result-sharing distribution across states
   *
   * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
   */
  async getImpactOutcomes(
    filters: DashboardFiltersDto,
  ): Promise<KpiEnvelope<ImpactOutcomesResponse>> {
    const academicYear = filters.academicYear || (await this.getCurrentYear());
    const stateCode = filters.stateCode || 'ALL';

    let query = `SELECT state_code                    AS "state_code",
                        sharing_of_result_label       AS "sharing_of_result_label",
                        state_level_decision_use_cases AS "state_level_decision_use_cases",
                        schools_improved              AS "schools_improved",
                        schools_with_prior_assessment AS "schools_with_prior_assessment",
                        pct_schools_improved          AS "pct_schools_improved",
                        avg_score_change              AS "avg_score_change"
                 FROM ${this.accrSchema}.mv_dash_impact_outcomes
                 WHERE academic_year = :1`;
    const params: (string | number)[] = [academicYear];
    if (stateCode !== 'ALL') {
      query += ` AND state_code = :2`;
      params.push(stateCode);
    }

    const rows = await this.dataSource.query(query, params);

    // KPI 15: Aggregate decision use cases across states.
    // In Oracle, state_level_decision_use_cases is stored as a JSON/CLOB string,
    // so parse it when it comes back as a string.
    const useCaseMap = new Map<string, { count: number; states: string[] }>();
    for (const row of rows) {
      const raw = row.state_level_decision_use_cases;
      let useCases: Record<string, unknown> = {};
      if (raw) {
        if (typeof raw === 'string') {
          try {
            useCases = JSON.parse(raw);
          } catch {
            useCases = {};
          }
        } else if (typeof raw === 'object') {
          useCases = raw as Record<string, unknown>;
        }
      }
      for (const [useCase, active] of Object.entries(useCases)) {
        if (active) {
          const existing = useCaseMap.get(useCase);
          if (existing) {
            existing.count += 1;
            existing.states.push(row.state_code);
          } else {
            useCaseMap.set(useCase, { count: 1, states: [row.state_code] });
          }
        }
      }
    }
    const decisionUseCases: Record<string, { count: number; states: string[] }> =
      Object.fromEntries(useCaseMap);

    // KPI 16: Improvement metrics — aggregate
    const totalImproved = rows.reduce(
      (sum: number, r: any) => sum + Number(r.schools_improved || 0),
      0,
    );
    const totalWithPrior = rows.reduce(
      (sum: number, r: any) => sum + Number(r.schools_with_prior_assessment || 0),
      0,
    );
    const pctImproved =
      totalWithPrior > 0
        ? Math.round((totalImproved / totalWithPrior) * 1000) / 10
        : 0;
    const numStates = rows.length || 1;
    const avgScoreChange = Math.round(
      rows.reduce((sum: number, r: any) => sum + Number(r.avg_score_change || 0), 0) /
        numStates * 100,
    ) / 100;

    // KPI 17: Result-sharing distribution
    const sharingMap = new Map<string, Set<string>>();
    for (const row of rows) {
      const label = row.sharing_of_result_label || 'Not Specified';
      const existing = sharingMap.get(label);
      if (existing) {
        existing.add(row.state_code);
      } else {
        sharingMap.set(label, new Set([row.state_code]));
      }
    }
    const sharingDistribution = Array.from(sharingMap.entries()).map(
      ([label, states]) => ({ label, state_count: states.size }),
    );

    return {
      kpi_no: [15, 16, 17],
      title: 'Impact/Outcomes & Decision-Making',
      as_of: new Date().toISOString(),
      filters: { stateCode, academicYear },
      data: {
        kpi_15: { decision_use_cases: decisionUseCases },
        kpi_16: {
          pct_schools_improved: pctImproved,
          schools_improved: Math.min(totalImproved, totalWithPrior),
          schools_with_prior: totalWithPrior,
          avg_score_change: avgScoreChange,
        },
        kpi_17: { sharing_distribution: sharingDistribution },
      },
      status: 'OK',
    };
  }

  /**
   * Returns all academic years ordered by start_year descending,
   * with a flag indicating the current active year.
   * Powers the academic year filter dropdown on the frontend.
   *
   * Validates: Requirement 15.1
   */
  async getAcademicYears(): Promise<Array<{ academic_year: string; is_current: boolean }>> {
    // Map the real academic_years schema (year_code, start_date, is_active)
    // onto the API contract (academic_year, is_current). "Current" = the active
    // year whose date range includes today.
    // ADW has no dedicated academic_years table. Derive the distinct list of
    // years from the dashboard MVs; flag the most recent one as "current".
    const rows = await this.dataSource.query(
      `SELECT academic_year AS "academic_year"
       FROM ${this.accrSchema}.mv_dash_coverage_reach
       WHERE academic_year IS NOT NULL
       GROUP BY academic_year
       ORDER BY academic_year DESC`,
    );
    return rows.map((row: { academic_year: string }, index: number) => ({
      academic_year: row.academic_year,
      is_current: index === 0, // most recent year (list is DESC)
    }));
  }

  /**
   * Returns all states/UTs with their state_code and state_name,
   * ordered alphabetically by state_name.
   * Powers the state/UT filter dropdown on the frontend.
   *
   * Validates: Requirement 15.2
   */
  async getStates(): Promise<Array<{ state_code: string; state_name: string }>> {
    const rows = await this.dataSource.query(
      `SELECT state_code AS "state_code", state_name AS "state_name"
       FROM ${this.accrSchema}.state_master ORDER BY state_name`,
    );
    return rows.map((row: { state_code: string; state_name: string }) => ({
      state_code: row.state_code,
      state_name: row.state_name,
    }));
  }

  /**
   * Refreshes all 6 materialized views if new ETL data has landed
   * since the last refresh. Performs a watermark check to avoid
   * unnecessary refresh operations.
   *
   * - Compares latest dw_load_ts from domain_assessment_flat with last MV refresh time
   * - Only calls refresh_dashboard_views() if new data exists
   * - Returns { refreshed: true, timestamp } on success
   * - Returns { refreshed: false, reason } when no new data is available
   *
   * Validates: Requirements 10.1, 10.2, 10.3, 10.5
   */
  async refreshViews(): Promise<RefreshResult> {
    // Step 1: Get latest ETL load timestamp from the flat fact table.
    const loadResult = await this.dataSource.query(
      `SELECT MAX(dw_load_ts) AS "max_load_ts"
       FROM ${this.accrSchema}.domain_assessment_flat`,
    );
    const maxLoadTs = loadResult[0]?.max_load_ts;

    // Step 2: Get the last MV refresh timestamp from the Oracle data dictionary.
    const refreshResult = await this.dataSource.query(
      `SELECT last_refresh_date AS "last_refresh"
       FROM all_mviews
       WHERE owner = UPPER(:1) AND mview_name = UPPER('MV_DASH_PROGRAMME_FRAMEWORK')`,
      [this.accrSchema],
    );
    const lastRefresh = refreshResult[0]?.last_refresh;

    // Step 3: Compare — only refresh if new data exists since the last refresh.
    if (maxLoadTs && (!lastRefresh || new Date(maxLoadTs) > new Date(lastRefresh))) {
      // Invoke the Oracle refresh procedure that refreshes all 6 MVs.
      await this.dataSource.query(
        `BEGIN ${this.accrSchema}.refresh_dashboard_views(); END;`,
      );
      return { refreshed: true, timestamp: new Date().toISOString() };
    }

    return { refreshed: false, reason: 'No new ETL data since last refresh' };
  }

  /**
   * Routes GET /kpi/:kpiNo to the appropriate section handler
   * and extracts only the requested KPI from the section response.
   *
   * KPIs 1–17 are valid and routed to their respective section handlers.
   * KPIs 18, 19, 20 are permanently excluded and return HTTP 404.
   * Non-integer or out-of-range values return HTTP 400.
   *
   * Validates: Requirements 9.1, 9.2, 9.3
   */
  async getKpiByNumber(
    kpiNo: number,
    filters: DashboardFiltersDto,
  ): Promise<KpiEnvelope<any>> {
    // Validate input is an integer and within a reasonable range
    if (!Number.isInteger(kpiNo) || kpiNo < 1 || kpiNo > 20) {
      throw new BadRequestException(
        `Invalid KPI number: ${kpiNo}. Must be an integer between 1 and 20.`,
      );
    }

    // KPI section routing map
    const KPI_SECTION_MAP: Record<number, { section: string; responseKey: string }> = {
      1:  { section: 'programme-framework', responseKey: 'kpi_1' },
      2:  { section: 'programme-framework', responseKey: 'kpi_2' },
      3:  { section: 'programme-framework', responseKey: 'kpi_3' },
      4:  { section: 'coverage-reach', responseKey: 'kpi_4' },
      5:  { section: 'coverage-reach', responseKey: 'kpi_5' },
      6:  { section: 'coverage-reach', responseKey: 'kpi_6' },
      7:  { section: 'process-operations', responseKey: 'kpi_7' },
      8:  { section: 'process-operations', responseKey: 'kpi_8' },
      9:  { section: 'process-operations', responseKey: 'kpi_9' },
      10: { section: 'process-operations', responseKey: 'kpi_10' },
      11: { section: 'domain-components', responseKey: 'kpi_11' },
      12: { section: 'domain-components', responseKey: 'kpi_12' },
      13: { section: 'data-quality', responseKey: 'kpi_13' },
      14: { section: 'data-quality', responseKey: 'kpi_14' },
      15: { section: 'impact-outcomes', responseKey: 'kpi_15' },
      16: { section: 'impact-outcomes', responseKey: 'kpi_16' },
      17: { section: 'impact-outcomes', responseKey: 'kpi_17' },
    };

    // KPIs 18, 19, 20 are not available
    if (!(kpiNo in KPI_SECTION_MAP)) {
      throw new NotFoundException(`KPI ${kpiNo} is not available`);
    }

    const { section, responseKey } = KPI_SECTION_MAP[kpiNo];

    // Route to the appropriate section handler
    let sectionResponse: KpiEnvelope<any>;
    switch (section) {
      case 'programme-framework':
        sectionResponse = await this.getProgrammeFramework(filters);
        break;
      case 'coverage-reach':
        sectionResponse = await this.getCoverageReach(filters);
        break;
      case 'process-operations':
        sectionResponse = await this.getProcessOperations(filters);
        break;
      case 'domain-components':
        sectionResponse = await this.getDomainComponents(filters);
        break;
      case 'data-quality':
        sectionResponse = await this.getDataQuality(filters);
        break;
      case 'impact-outcomes':
        sectionResponse = await this.getImpactOutcomes(filters);
        break;
      default:
        throw new NotFoundException(`KPI ${kpiNo} is not available`);
    }

    // Extract only the specific KPI data from the section response
    const kpiData = sectionResponse.data[responseKey];

    return {
      kpi_no: kpiNo,
      title: sectionResponse.title,
      as_of: sectionResponse.as_of,
      filters: sectionResponse.filters,
      data: kpiData,
      status: 'OK',
    };
  }
}

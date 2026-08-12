import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SCHEME_CODES, TABLE_NAMES } from './constants';

@Injectable()
export class SchemesService {
  private readonly logger = new Logger(SchemesService.name);
  private readonly schema: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.schema = this.configService.get<string>('SCHEMES_SCHEMA', 'WKSP_VSKDEV');
  }

  // â”€â”€â”€ KPI Routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getKpis(schemeCode: string, stateName?: string) {
    switch (schemeCode) {
      case SCHEME_CODES.PM_SHRI:
        return this.getPmShriKpis(stateName);
      case SCHEME_CODES.PGI:
        return this.getGenericKpis(TABLE_NAMES.PGI, stateName);
      case SCHEME_CODES.NAS:
        return this.getGenericKpis(TABLE_NAMES.NAS, stateName);
      case SCHEME_CODES.UDISE_PLUS:
        return this.getGenericKpis(TABLE_NAMES.UDISE, stateName);
      case SCHEME_CODES.NIPUN_BHARAT:
        return this.getGenericKpis(TABLE_NAMES.NIPUN_CONTENT, stateName);
      case SCHEME_CODES.NCERT_QUIZ:
        return this.getGenericKpis(TABLE_NAMES.NCERT_QUIZ_STATE, stateName);
      case SCHEME_CODES.NCF:
        return this.getGenericKpis(TABLE_NAMES.NCF, stateName);
      case SCHEME_CODES.PRASHAST:
        return this.getGenericKpis(TABLE_NAMES.PRASHAST, stateName);
      case SCHEME_CODES.NISHTHA:
        return this.getGenericKpis(TABLE_NAMES.NISHTHA_PARTICIPANTS, stateName);
      case SCHEME_CODES.PM_POSHAN:
        return this.getGenericKpis(TABLE_NAMES.PM_POSHAN, stateName);
      case SCHEME_CODES.MICRO_IMPROVEMENT:
        return this.getGenericKpis(TABLE_NAMES.MICRO_IMPROVEMENTS_STATE, stateName);
      case SCHEME_CODES.DIKSHA_ETB:
        return this.getGenericKpis(TABLE_NAMES.DIKSHA_ETB_COVERAGE, stateName);
      default:
        return { error: `Unknown scheme: ${schemeCode}` };
    }
  }

  // â”€â”€â”€ Summary Routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getSummary(schemeCode: string, stateName?: string) {
    switch (schemeCode) {
      case SCHEME_CODES.PM_SHRI:
        return this.getPmShriSummary(stateName);
      default:
        return this.getKpis(schemeCode, stateName);
    }
  }

  // â”€â”€â”€ Map Data Routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getMapData(schemeCode: string, stateName?: string) {
    switch (schemeCode) {
      case SCHEME_CODES.PM_SHRI:
        return this.getPmShriMapData(stateName);
      case SCHEME_CODES.PGI:
        return this.getGenericMapData(TABLE_NAMES.PGI_STATE_WISE);
      case SCHEME_CODES.NAS:
        return this.getGenericMapData(TABLE_NAMES.NAS);
      case SCHEME_CODES.UDISE_PLUS:
        return this.getGenericMapData(TABLE_NAMES.UDISE);
      case SCHEME_CODES.MICRO_IMPROVEMENT:
        return this.getGenericMapData(TABLE_NAMES.MICRO_IMPROVEMENTS_STATE);
      default:
        return this.getGenericMapData(this.getTableForScheme(schemeCode));
    }
  }

  // â”€â”€â”€ State-wise Routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getStatewise(schemeCode: string) {
    switch (schemeCode) {
      case SCHEME_CODES.PM_SHRI:
        return this.getPmShriStatewise();
      case SCHEME_CODES.PGI:
        return this.getGenericStatewise(TABLE_NAMES.PGI_STATE_WISE);
      case SCHEME_CODES.NAS:
        return this.getGenericStatewise(TABLE_NAMES.NAS);
      case SCHEME_CODES.UDISE_PLUS:
        return this.getGenericStatewise(TABLE_NAMES.UDISE);
      case SCHEME_CODES.MICRO_IMPROVEMENT:
        return this.getGenericStatewise(TABLE_NAMES.MICRO_IMPROVEMENTS_STATE);
      default:
        return this.getGenericStatewise(this.getTableForScheme(schemeCode));
    }
  }

  // â”€â”€â”€ District-wise Routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getDistrictwise(schemeCode: string, stateName?: string) {
    switch (schemeCode) {
      case SCHEME_CODES.PM_SHRI:
        return this.getPmShriDistrictwise(stateName);
      case SCHEME_CODES.MICRO_IMPROVEMENT:
        return this.getGenericDistrictwise(TABLE_NAMES.MICRO_IMPROVEMENTS_DISTRICT, stateName);
      default:
        return this.getGenericDistrictwise(this.getTableForScheme(schemeCode), stateName);
    }
  }

  // â”€â”€â”€ School-wise Routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getSchoolwise(schemeCode: string, stateName?: string, districtName?: string) {
    switch (schemeCode) {
      case SCHEME_CODES.PM_SHRI:
        return this.getPmShriSchoolwise(stateName, districtName);
      default:
        return { error: `School-wise data not available for scheme: ${schemeCode}` };
    }
  }

  // â”€â”€â”€ Charts Routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getCharts(schemeCode: string, chartType?: string, stateName?: string) {
    switch (schemeCode) {
      case SCHEME_CODES.PM_SHRI:
        return this.getPmShriCharts(chartType, stateName);
      case SCHEME_CODES.NISHTHA:
        return this.getNishthaCharts(chartType);
      default:
        return this.getGenericStatewise(this.getTableForScheme(schemeCode));
    }
  }

  // â”€â”€â”€ Performance Routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getPerformance(schemeCode: string, stateName?: string, districtName?: string) {
    switch (schemeCode) {
      case SCHEME_CODES.PM_SHRI:
        return this.getPmShriPerformance(stateName, districtName);
      case SCHEME_CODES.PGI:
        return this.getGenericStatewise(TABLE_NAMES.PGI_STATE_WISE);
      default:
        return this.getGenericStatewise(this.getTableForScheme(schemeCode));
    }
  }

  // â”€â”€â”€ Filters Routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getFilters(schemeCode: string) {
    switch (schemeCode) {
      case SCHEME_CODES.PM_SHRI:
        return this.getPmShriFilters();
      default:
        return this.getGenericFilters(this.getTableForScheme(schemeCode));
    }
  }

  async getDistrictFilters(schemeCode: string, stateName?: string) {
    switch (schemeCode) {
      case SCHEME_CODES.PM_SHRI:
        return this.getPmShriDistrictFilters(stateName);
      default:
        return { districts: [] };
    }
  }

  async getSchoolFilters(schemeCode: string, stateName?: string, districtName?: string) {
    switch (schemeCode) {
      case SCHEME_CODES.PM_SHRI:
        return this.getPmShriSchoolFilters(stateName, districtName);
      default:
        return { schools: [] };
    }
  }

  // â”€â”€â”€ Detailed Stats Routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getDetailedStats(schemeCode: string, stateName?: string, districtName?: string) {
    switch (schemeCode) {
      case SCHEME_CODES.PM_SHRI:
        return this.getPmShriDetailedStats(stateName, districtName);
      default:
        return this.getGenericKpis(this.getTableForScheme(schemeCode), stateName);
    }
  }


  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PM_SHRI Implementations
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  private async getPmShriKpis(stateName?: string) {
    let sql = `
      SELECT
        COUNT(*) AS total_schools,
        NVL(SUM(CASE WHEN ICT_LAB = 1 THEN 1 ELSE 0 END), 0) AS schools_with_ict,
        NVL(SUM(CASE WHEN SMART_CLASSROOM = 1 THEN 1 ELSE 0 END), 0) AS schools_with_smart_classroom,
        NVL(SUM(CASE WHEN DIGITAL_LIBRARY = 1 THEN 1 ELSE 0 END), 0) AS schools_with_digital_library,
        NVL(SUM(TOTAL_CWSN), 0) AS total_cwsn
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
    `;
    const params: string[] = [];

    if (stateName) {
      sql += ` WHERE STATE_NAME = :1`;
      params.push(stateName);
    }

    return this.executeQuery(sql, params);
  }

  private async getPmShriSummary(stateName?: string) {
    let sql = `
      SELECT
        COUNT(*) AS total_schools,
        COUNT(DISTINCT STATE_NAME) AS total_states,
        COUNT(DISTINCT DISTRICT_NAME) AS total_districts,
        NVL(SUM(CASE WHEN ICT_LAB = 1 THEN 1 ELSE 0 END), 0) AS ict_labs,
        NVL(SUM(CASE WHEN SMART_CLASSROOM = 1 THEN 1 ELSE 0 END), 0) AS smart_classrooms,
        NVL(SUM(CASE WHEN DIGITAL_LIBRARY = 1 THEN 1 ELSE 0 END), 0) AS digital_libraries,
        NVL(SUM(TOTAL_CWSN), 0) AS total_cwsn
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
    `;
    const params: string[] = [];

    if (stateName) {
      sql += ` WHERE STATE_NAME = :1`;
      params.push(stateName);
    }

    return this.executeQuery(sql, params);
  }

  private async getPmShriMapData(stateName?: string) {
    let sql = `
      SELECT
        UDISE_SCH_CODE,
        SCHOOL_NAME,
        LATITUDE,
        LONGITUDE,
        BLOCK_NAME,
        DISTRICT_NAME,
        STATE_NAME
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
      WHERE LATITUDE IS NOT NULL AND LONGITUDE IS NOT NULL
    `;
    const params: string[] = [];

    if (stateName) {
      sql += ` AND STATE_NAME = :1`;
      params.push(stateName);
    }

    return this.executeQuery(sql, params);
  }

  private async getPmShriStatewise() {
    const sql = `
      SELECT
        STATE_NAME,
        COUNT(*) AS total_schools,
        NVL(SUM(CASE WHEN ICT_LAB = 1 THEN 1 ELSE 0 END), 0) AS ict_labs,
        NVL(SUM(CASE WHEN SMART_CLASSROOM = 1 THEN 1 ELSE 0 END), 0) AS smart_classrooms,
        NVL(SUM(CASE WHEN DIGITAL_LIBRARY = 1 THEN 1 ELSE 0 END), 0) AS digital_libraries,
        NVL(SUM(TOTAL_CWSN), 0) AS total_cwsn
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
      GROUP BY STATE_NAME
      ORDER BY STATE_NAME
    `;
    return this.executeQuery(sql, []);
  }

  private async getPmShriDistrictwise(stateName?: string) {
    if (!stateName) {
      return { error: 'stateName query parameter is required' };
    }

    const sql = `
      SELECT
        DISTRICT_NAME,
        COUNT(*) AS total_schools,
        NVL(SUM(CASE WHEN ICT_LAB = 1 THEN 1 ELSE 0 END), 0) AS ict_labs,
        NVL(SUM(CASE WHEN SMART_CLASSROOM = 1 THEN 1 ELSE 0 END), 0) AS smart_classrooms,
        NVL(SUM(CASE WHEN DIGITAL_LIBRARY = 1 THEN 1 ELSE 0 END), 0) AS digital_libraries,
        NVL(SUM(TOTAL_CWSN), 0) AS total_cwsn
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
      WHERE STATE_NAME = :1
      GROUP BY DISTRICT_NAME
      ORDER BY DISTRICT_NAME
    `;
    return this.executeQuery(sql, [stateName]);
  }

  private async getPmShriSchoolwise(stateName?: string, districtName?: string) {
    let sql = `
      SELECT
        UDISE_SCH_CODE,
        SCHOOL_NAME,
        BLOCK_NAME,
        DISTRICT_NAME,
        STATE_NAME,
        ICT_LAB,
        SMART_CLASSROOM,
        DIGITAL_LIBRARY,
        TOTAL_CWSN,
        LATITUDE,
        LONGITUDE
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
      WHERE 1=1
    `;
    const params: string[] = [];
    let paramIndex = 1;

    if (stateName) {
      sql += ` AND STATE_NAME = :${paramIndex}`;
      params.push(stateName);
      paramIndex++;
    }

    if (districtName) {
      sql += ` AND DISTRICT_NAME = :${paramIndex}`;
      params.push(districtName);
      paramIndex++;
    }

    sql += ` ORDER BY SCHOOL_NAME`;
    return this.executeQuery(sql, params);
  }

  private async getPmShriCharts(chartType?: string, stateName?: string) {
    switch (chartType) {
      case 'infrastructure':
        return this.getPmShriInfrastructureChart(stateName);
      case 'enrollment':
        return this.getPmShriEnrollmentChart(stateName);
      default:
        return this.getPmShriInfrastructureChart(stateName);
    }
  }

  private async getPmShriInfrastructureChart(stateName?: string) {
    let sql = `
      SELECT
        NVL(SUM(CASE WHEN ICT_LAB = 1 THEN 1 ELSE 0 END), 0) AS ict_labs,
        NVL(SUM(CASE WHEN SMART_CLASSROOM = 1 THEN 1 ELSE 0 END), 0) AS smart_classrooms,
        NVL(SUM(CASE WHEN DIGITAL_LIBRARY = 1 THEN 1 ELSE 0 END), 0) AS digital_libraries
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
    `;
    const params: string[] = [];

    if (stateName) {
      sql += ` WHERE STATE_NAME = :1`;
      params.push(stateName);
    }

    return this.executeQuery(sql, params);
  }

  private async getPmShriEnrollmentChart(stateName?: string) {
    let sql = `
      SELECT
        STATE_NAME,
        NVL(SUM(TOTAL_CWSN), 0) AS total_cwsn,
        COUNT(*) AS total_schools
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
    `;
    const params: string[] = [];

    if (stateName) {
      sql += ` WHERE STATE_NAME = :1`;
      params.push(stateName);
    }

    sql += ` GROUP BY STATE_NAME ORDER BY STATE_NAME`;
    return this.executeQuery(sql, params);
  }

  private async getPmShriPerformance(stateName?: string, districtName?: string) {
    let sql = `
      SELECT
        STATE_NAME,
        DISTRICT_NAME,
        COUNT(*) AS total_schools,
        NVL(SUM(CASE WHEN ICT_LAB = 1 THEN 1 ELSE 0 END), 0) AS ict_labs,
        NVL(SUM(CASE WHEN SMART_CLASSROOM = 1 THEN 1 ELSE 0 END), 0) AS smart_classrooms
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
      WHERE 1=1
    `;
    const params: string[] = [];
    let paramIndex = 1;

    if (stateName) {
      sql += ` AND STATE_NAME = :${paramIndex}`;
      params.push(stateName);
      paramIndex++;
    }

    if (districtName) {
      sql += ` AND DISTRICT_NAME = :${paramIndex}`;
      params.push(districtName);
      paramIndex++;
    }

    sql += ` GROUP BY STATE_NAME, DISTRICT_NAME ORDER BY STATE_NAME, DISTRICT_NAME`;
    return this.executeQuery(sql, params);
  }

  private async getPmShriFilters() {
    const sql = `
      SELECT DISTINCT STATE_NAME
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
      WHERE STATE_NAME IS NOT NULL
      ORDER BY STATE_NAME
    `;
    const rows = await this.executeQuery(sql, []);
    return { states: rows };
  }

  private async getPmShriDistrictFilters(stateName?: string) {
    if (!stateName) {
      return { districts: [] };
    }

    const sql = `
      SELECT DISTINCT DISTRICT_NAME
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
      WHERE STATE_NAME = :1 AND DISTRICT_NAME IS NOT NULL
      ORDER BY DISTRICT_NAME
    `;
    const rows = await this.executeQuery(sql, [stateName]);
    return { districts: rows };
  }

  private async getPmShriSchoolFilters(stateName?: string, districtName?: string) {
    if (!stateName || !districtName) {
      return { schools: [] };
    }

    const sql = `
      SELECT UDISE_SCH_CODE, SCHOOL_NAME
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
      WHERE STATE_NAME = :1 AND DISTRICT_NAME = :2
      ORDER BY SCHOOL_NAME
    `;
    const rows = await this.executeQuery(sql, [stateName, districtName]);
    return { schools: rows };
  }

  private async getPmShriDetailedStats(stateName?: string, districtName?: string) {
    let sql = `
      SELECT
        COUNT(*) AS total_schools,
        COUNT(DISTINCT STATE_NAME) AS total_states,
        COUNT(DISTINCT DISTRICT_NAME) AS total_districts,
        COUNT(DISTINCT BLOCK_NAME) AS total_blocks,
        NVL(SUM(CASE WHEN ICT_LAB = 1 THEN 1 ELSE 0 END), 0) AS ict_labs,
        NVL(SUM(CASE WHEN SMART_CLASSROOM = 1 THEN 1 ELSE 0 END), 0) AS smart_classrooms,
        NVL(SUM(CASE WHEN DIGITAL_LIBRARY = 1 THEN 1 ELSE 0 END), 0) AS digital_libraries,
        NVL(SUM(TOTAL_CWSN), 0) AS total_cwsn
      FROM ${this.schema}.${TABLE_NAMES.PMSHRI}
      WHERE 1=1
    `;
    const params: string[] = [];
    let paramIndex = 1;

    if (stateName) {
      sql += ` AND STATE_NAME = :${paramIndex}`;
      params.push(stateName);
      paramIndex++;
    }

    if (districtName) {
      sql += ` AND DISTRICT_NAME = :${paramIndex}`;
      params.push(districtName);
      paramIndex++;
    }

    return this.executeQuery(sql, params);
  }


  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // NISHTHA Charts
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  private async getNishthaCharts(chartType?: string) {
    switch (chartType) {
      case 'participants':
        return this.executeQuery(
          `SELECT * FROM ${this.schema}.${TABLE_NAMES.NISHTHA_PARTICIPANTS}`,
          [],
        );
      case 'certification':
        return this.executeQuery(
          `SELECT * FROM ${this.schema}.${TABLE_NAMES.NISHTHA_CERTIFICATION}`,
          [],
        );
      case 'status':
        return this.executeQuery(
          `SELECT * FROM ${this.schema}.${TABLE_NAMES.NISHTHA_PROGRAM_STATUS}`,
          [],
        );
      default:
        return this.executeQuery(
          `SELECT * FROM ${this.schema}.${TABLE_NAMES.NISHTHA_PARTICIPANTS}`,
          [],
        );
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // Generic Implementations
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  private async getGenericKpis(tableName: string, stateName?: string) {
    let sql = `SELECT COUNT(*) AS total_count FROM ${this.schema}.${tableName}`;
    const params: string[] = [];

    if (stateName) {
      sql += ` WHERE STATE_NAME = :1`;
      params.push(stateName);
    }

    return this.executeQuery(sql, params);
  }

  private async getGenericStatewise(tableName: string) {
    const sql = `SELECT * FROM ${this.schema}.${tableName} ORDER BY STATE_NAME`;
    return this.executeQuery(sql, []);
  }

  private async getGenericMapData(tableName: string) {
    const sql = `
      SELECT STATE_NAME, COUNT(*) AS total_count
      FROM ${this.schema}.${tableName}
      GROUP BY STATE_NAME
      ORDER BY STATE_NAME
    `;
    return this.executeQuery(sql, []);
  }

  private async getGenericDistrictwise(tableName: string, stateName?: string) {
    if (!stateName) {
      return { error: 'stateName query parameter is required' };
    }

    const sql = `SELECT * FROM ${this.schema}.${tableName} WHERE STATE_NAME = :1 ORDER BY DISTRICT_NAME`;
    return this.executeQuery(sql, [stateName]);
  }

  private async getGenericFilters(tableName: string) {
    const sql = `
      SELECT DISTINCT STATE_NAME
      FROM ${this.schema}.${tableName}
      WHERE STATE_NAME IS NOT NULL
      ORDER BY STATE_NAME
    `;
    const rows = await this.executeQuery(sql, []);
    return { states: rows };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // Helpers
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  private getTableForScheme(schemeCode: string): string {
    const mapping: Record<string, string> = {
      [SCHEME_CODES.PM_SHRI]: TABLE_NAMES.PMSHRI,
      [SCHEME_CODES.PGI]: TABLE_NAMES.PGI,
      [SCHEME_CODES.NAS]: TABLE_NAMES.NAS,
      [SCHEME_CODES.UDISE_PLUS]: TABLE_NAMES.UDISE,
      [SCHEME_CODES.NIPUN_BHARAT]: TABLE_NAMES.NIPUN_CONTENT,
      [SCHEME_CODES.NCERT_QUIZ]: TABLE_NAMES.NCERT_QUIZ_STATE,
      [SCHEME_CODES.NCF]: TABLE_NAMES.NCF,
      [SCHEME_CODES.PRASHAST]: TABLE_NAMES.PRASHAST,
      [SCHEME_CODES.NISHTHA]: TABLE_NAMES.NISHTHA_PARTICIPANTS,
      [SCHEME_CODES.PM_POSHAN]: TABLE_NAMES.PM_POSHAN,
      [SCHEME_CODES.MICRO_IMPROVEMENT]: TABLE_NAMES.MICRO_IMPROVEMENTS_STATE,
      [SCHEME_CODES.DIKSHA_ETB]: TABLE_NAMES.DIKSHA_ETB_COVERAGE,
    };
    return mapping[schemeCode] || TABLE_NAMES.PMSHRI;
  }

  private async executeQuery(sql: string, params: string[]): Promise<any[]> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      try {
        const result = await queryRunner.query(sql, params);
        return result;
      } finally {
        await queryRunner.release();
      }
    } catch (error: any) {
      this.logger.error(`Query failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}

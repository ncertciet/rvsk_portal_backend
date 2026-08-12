import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);
  private readonly adwSchema: string;
  private readonly attendanceSchema: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.adwSchema = this.configService.get<string>('ADW_SCHEMA', 'WKSP_VSKDEV');
    this.attendanceSchema = this.configService.get<string>('ATTENDANCE_SCHEMA', 'ATTENDANCE');
  }

  private wrapResponse(data: any) {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  private wrapPaginatedResponse(data: any[], page: number, size: number, totalElements: number) {
    const totalPages = Math.ceil(totalElements / size);
    return {
      success: true,
      timestamp: new Date().toISOString(),
      data,
      meta: {
        page,
        size,
        totalElements,
        totalPages,
      },
    };
  }

  async getIntegrationCoverage() {
    const sql = `
      SELECT
        COUNT(*) AS "totalSchools",
        COUNT(DISTINCT STATE_ID) AS "totalStates",
        COUNT(DISTINCT DISTRICT_ID) AS "totalDistricts",
        COUNT(DISTINCT BLOCK_ID) AS "totalBlocks",
        NVL(SUM(TOTAL_TEACHERS), 0) AS "totalTeachers",
        NVL(SUM(TOTAL_STUDENTS), 0) AS "totalStudents"
      FROM ${this.adwSchema}.SCHOOL
    `;
    const results = await this.dataSource.query(sql);
    return this.wrapResponse(results[0] || {});
  }

  async getSummary(date: string, stateId?: string) {
    const params: any[] = [date];
    let stateJoin = '';
    let stateFilter = '';
    if (stateId) {
      stateJoin = `JOIN ${this.adwSchema}.SCHOOL s ON sa.UDISE_CODE = s.UDISE_CODE`;
      stateFilter = 'AND s.STATE_ID = :2';
      params.push(stateId);
    }

    const studentSql = `
      SELECT
        COUNT(DISTINCT sa.UDISE_CODE) AS "schoolsReporting",
        NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) AS "presentStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0) AS "absentStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) + NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0) AS "totalStudents",
        ROUND(
          NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) * 100.0 /
          NULLIF(NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) + NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0), 0), 2
        ) AS "studentAttendancePercent"
      FROM ${this.attendanceSchema}.STUDENT_ATTENDANCE sa
      ${stateJoin}
      WHERE TRUNC(sa.ATTENDANCE_DATE) = TO_DATE(:1, 'YYYY-MM-DD')
      ${stateFilter}
    `;

    const teacherParams: any[] = [date];
    let teacherStateJoin = '';
    let teacherStateFilter = '';
    if (stateId) {
      teacherStateJoin = `JOIN ${this.adwSchema}.SCHOOL s ON ta.UDISE_CODE = s.UDISE_CODE`;
      teacherStateFilter = 'AND s.STATE_ID = :2';
      teacherParams.push(stateId);
    }

    const teacherSql = `
      SELECT
        COUNT(DISTINCT ta.UDISE_CODE) AS "schoolsReporting",
        NVL(SUM(ta.TOTAL_TEACHERS_MARKED), 0) AS "totalTeachers",
        NVL(SUM(ta.TOTAL_TEACHERS_PRESENT), 0) AS "presentTeachers",
        NVL(SUM(ta.TOTAL_TEACHERS_ABSENT), 0) AS "absentTeachers",
        ROUND(
          NVL(SUM(ta.TOTAL_TEACHERS_PRESENT), 0) * 100.0 /
          NULLIF(NVL(SUM(ta.TOTAL_TEACHERS_MARKED), 0), 0), 2
        ) AS "teacherAttendancePercent"
      FROM ${this.attendanceSchema}.TEACHER_ATTENDANCE ta
      ${teacherStateJoin}
      WHERE TRUNC(ta.ATTENDANCE_DATE) = TO_DATE(:1, 'YYYY-MM-DD')
      ${teacherStateFilter}
    `;

    const [studentResults, teacherResults] = await Promise.all([
      this.dataSource.query(studentSql, params),
      this.dataSource.query(teacherSql, teacherParams),
    ]);

    return this.wrapResponse({
      students: studentResults[0] || {},
      teachers: teacherResults[0] || {},
    });
  }

  async getStateTable(date: string) {
    const sql = `
      SELECT
        s.STATE_ID AS "stateId",
        s.STATE_NAME AS "stateName",
        COUNT(DISTINCT sa.UDISE_CODE) AS "schoolsReporting",
        NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) AS "presentStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0) AS "absentStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) + NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0) AS "totalStudents",
        ROUND(
          NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) * 100.0 /
          NULLIF(NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) + NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0), 0), 2
        ) AS "attendancePercent"
      FROM ${this.attendanceSchema}.STUDENT_ATTENDANCE sa
      JOIN ${this.adwSchema}.SCHOOL s ON sa.UDISE_CODE = s.UDISE_CODE
      WHERE TRUNC(sa.ATTENDANCE_DATE) = TO_DATE(:1, 'YYYY-MM-DD')
      GROUP BY s.STATE_ID, s.STATE_NAME
      ORDER BY s.STATE_NAME
    `;
    const results = await this.dataSource.query(sql, [date]);
    return this.wrapResponse(results);
  }

  async getRegionalLeaders(date: string) {
    const sql = `
      SELECT
        s.STATE_ID AS "stateId",
        s.STATE_NAME AS "stateName",
        COUNT(DISTINCT sa.UDISE_CODE) AS "schoolsReporting",
        NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) AS "presentStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0) AS "absentStudents",
        ROUND(
          NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) * 100.0 /
          NULLIF(NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) + NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0), 0), 2
        ) AS "attendancePercent"
      FROM ${this.attendanceSchema}.STUDENT_ATTENDANCE sa
      JOIN ${this.adwSchema}.SCHOOL s ON sa.UDISE_CODE = s.UDISE_CODE
      WHERE TRUNC(sa.ATTENDANCE_DATE) = TO_DATE(:1, 'YYYY-MM-DD')
      GROUP BY s.STATE_ID, s.STATE_NAME
      ORDER BY "attendancePercent" DESC
    `;
    const results = await this.dataSource.query(sql, [date]);

    const top5 = results.slice(0, 5);
    const bottom5 = results.slice(-5).reverse();

    return this.wrapResponse({ top5, bottom5 });
  }

  async getTrends(days?: string, startDate?: string, endDate?: string, stateId?: string) {
    const params: any[] = [];
    let dateFilter = '';
    let stateJoin = '';
    let stateFilter = '';

    if (startDate && endDate) {
      dateFilter = "TRUNC(sa.ATTENDANCE_DATE) BETWEEN TO_DATE(:1, 'YYYY-MM-DD') AND TO_DATE(:2, 'YYYY-MM-DD')";
      params.push(startDate, endDate);
    } else {
      const numDays = parseInt(days || '30', 10);
      dateFilter = `TRUNC(sa.ATTENDANCE_DATE) >= TRUNC(SYSDATE) - ${numDays}`;
    }

    if (stateId) {
      stateJoin = `JOIN ${this.adwSchema}.SCHOOL s ON sa.UDISE_CODE = s.UDISE_CODE`;
      stateFilter = `AND s.STATE_ID = :${params.length + 1}`;
      params.push(stateId);
    }

    const sql = `
      SELECT
        TO_CHAR(TRUNC(sa.ATTENDANCE_DATE), 'YYYY-MM-DD') AS "date",
        NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) AS "presentStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0) AS "absentStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) + NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0) AS "totalStudents",
        ROUND(
          NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) * 100.0 /
          NULLIF(NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) + NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0), 0), 2
        ) AS "attendancePercent"
      FROM ${this.attendanceSchema}.STUDENT_ATTENDANCE sa
      ${stateJoin}
      WHERE ${dateFilter}
      ${stateFilter}
      GROUP BY TRUNC(sa.ATTENDANCE_DATE)
      ORDER BY TRUNC(sa.ATTENDANCE_DATE)
    `;
    const results = await this.dataSource.query(sql, params);
    return this.wrapResponse(results);
  }

  async getDetailed(
    date: string,
    stateId?: string,
    districtId?: string,
    blockId?: string,
    clusterId?: string,
    page = 1,
    size = 20,
  ) {
    const params: any[] = [date];
    const filters: string[] = [];

    if (stateId) {
      filters.push(`s.STATE_ID = :${params.length + 1}`);
      params.push(stateId);
    }
    if (districtId) {
      filters.push(`s.DISTRICT_ID = :${params.length + 1}`);
      params.push(districtId);
    }
    if (blockId) {
      filters.push(`s.BLOCK_ID = :${params.length + 1}`);
      params.push(blockId);
    }
    if (clusterId) {
      filters.push(`s.CLUSTER_ID = :${params.length + 1}`);
      params.push(clusterId);
    }

    const filterClause = filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';
    const offset = (page - 1) * size;

    const countSql = `
      SELECT COUNT(*) AS "total"
      FROM ${this.attendanceSchema}.STUDENT_ATTENDANCE sa
      JOIN ${this.adwSchema}.SCHOOL s ON sa.UDISE_CODE = s.UDISE_CODE
      WHERE TRUNC(sa.ATTENDANCE_DATE) = TO_DATE(:1, 'YYYY-MM-DD')
      ${filterClause}
    `;

    const dataSql = `
      SELECT
        s.UDISE_CODE AS "udiseCode",
        s.SCHOOL_NAME AS "schoolName",
        s.STATE_NAME AS "stateName",
        s.DISTRICT_NAME AS "districtName",
        s.BLOCK_NAME AS "blockName",
        s.CLUSTER_NAME AS "clusterName",
        NVL(sa.TOTAL_STUDENTS_PRESENT, 0) AS "presentStudents",
        NVL(sa.TOTAL_STUDENTS_ABSENT, 0) AS "absentStudents",
        NVL(sa.TOTAL_STUDENTS_PRESENT, 0) + NVL(sa.TOTAL_STUDENTS_ABSENT, 0) AS "totalStudents",
        ROUND(
          NVL(sa.TOTAL_STUDENTS_PRESENT, 0) * 100.0 /
          NULLIF(NVL(sa.TOTAL_STUDENTS_PRESENT, 0) + NVL(sa.TOTAL_STUDENTS_ABSENT, 0), 0), 2
        ) AS "attendancePercent"
      FROM ${this.attendanceSchema}.STUDENT_ATTENDANCE sa
      JOIN ${this.adwSchema}.SCHOOL s ON sa.UDISE_CODE = s.UDISE_CODE
      WHERE TRUNC(sa.ATTENDANCE_DATE) = TO_DATE(:1, 'YYYY-MM-DD')
      ${filterClause}
      ORDER BY s.STATE_NAME, s.DISTRICT_NAME, s.SCHOOL_NAME
      OFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY
    `;

    const [countResult, dataResults] = await Promise.all([
      this.dataSource.query(countSql, params),
      this.dataSource.query(dataSql, params),
    ]);

    const totalElements = parseInt(countResult[0]?.total || '0', 10);
    return this.wrapPaginatedResponse(dataResults, page, size, totalElements);
  }

  async getMonthly(year: string, stateId?: string) {
    const params: any[] = [year];
    let stateJoin = '';
    let stateFilter = '';
    if (stateId) {
      stateJoin = `JOIN ${this.adwSchema}.SCHOOL s ON sa.UDISE_CODE = s.UDISE_CODE`;
      stateFilter = 'AND s.STATE_ID = :2';
      params.push(stateId);
    }

    const sql = `
      SELECT
        EXTRACT(MONTH FROM sa.ATTENDANCE_DATE) AS "month",
        NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) AS "presentStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0) AS "absentStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) + NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0) AS "totalStudents",
        COUNT(DISTINCT TRUNC(sa.ATTENDANCE_DATE)) AS "daysReported",
        ROUND(
          NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) * 100.0 /
          NULLIF(NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) + NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0), 0), 2
        ) AS "attendancePercent"
      FROM ${this.attendanceSchema}.STUDENT_ATTENDANCE sa
      ${stateJoin}
      WHERE EXTRACT(YEAR FROM sa.ATTENDANCE_DATE) = TO_NUMBER(:1)
      ${stateFilter}
      GROUP BY EXTRACT(MONTH FROM sa.ATTENDANCE_DATE)
      ORDER BY EXTRACT(MONTH FROM sa.ATTENDANCE_DATE)
    `;
    const results = await this.dataSource.query(sql, params);
    return this.wrapResponse(results);
  }

  async getSchools(
    stateId?: string,
    districtId?: string,
    blockId?: string,
    search?: string,
    page = 1,
    size = 20,
    date?: string,
  ) {
    const params: any[] = [];
    const filters: string[] = [];

    if (stateId) {
      filters.push(`s.STATE_ID = :${params.length + 1}`);
      params.push(stateId);
    }
    if (districtId) {
      filters.push(`s.DISTRICT_ID = :${params.length + 1}`);
      params.push(districtId);
    }
    if (blockId) {
      filters.push(`s.BLOCK_ID = :${params.length + 1}`);
      params.push(blockId);
    }
    if (search) {
      filters.push(`UPPER(s.SCHOOL_NAME) LIKE :${params.length + 1}`);
      params.push(`%${search.toUpperCase()}%`);
    }

    const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
    const offset = (page - 1) * size;

    const countSql = `
      SELECT COUNT(*) AS "total"
      FROM ${this.adwSchema}.SCHOOL s
      ${whereClause}
    `;

    if (date) {
      // Include attendance data for the given date
      const dateParamIdx = params.length + 1;
      const dateParams = [...params, date];

      const dataSql = `
        SELECT
          s.UDISE_CODE AS "udiseCode",
          s.SCHOOL_NAME AS "schoolName",
          s.STATE_NAME AS "stateName",
          s.DISTRICT_NAME AS "districtName",
          s.BLOCK_NAME AS "blockName",
          s.CLUSTER_NAME AS "clusterName",
          NVL(s.TOTAL_STUDENTS, 0) AS "totalStudents",
          NVL(s.TOTAL_TEACHERS, 0) AS "totalTeachers",
          NVL(att.STUDENTS_PRESENT, 0) AS "presentStudents",
          NVL(att.STUDENTS_ABSENT, 0) AS "absentStudents",
          ROUND(
            NVL(att.STUDENTS_PRESENT, 0) * 100.0 /
            NULLIF(NVL(att.STUDENTS_PRESENT, 0) + NVL(att.STUDENTS_ABSENT, 0), 0), 2
          ) AS "attendancePercent"
        FROM ${this.adwSchema}.SCHOOL s
        LEFT JOIN (
          SELECT
            UDISE_CODE,
            SUM(TOTAL_STUDENTS_PRESENT) AS STUDENTS_PRESENT,
            SUM(TOTAL_STUDENTS_ABSENT) AS STUDENTS_ABSENT
          FROM ${this.attendanceSchema}.STUDENT_ATTENDANCE
          WHERE TRUNC(ATTENDANCE_DATE) = TO_DATE(:${dateParamIdx}, 'YYYY-MM-DD')
          GROUP BY UDISE_CODE
        ) att ON s.UDISE_CODE = att.UDISE_CODE
        ${whereClause}
        ORDER BY s.SCHOOL_NAME
        OFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY
      `;

      const [countResult, dataResults] = await Promise.all([
        this.dataSource.query(countSql, params),
        this.dataSource.query(dataSql, dateParams),
      ]);

      const totalElements = parseInt(countResult[0]?.total || '0', 10);
      return this.wrapPaginatedResponse(dataResults, page, size, totalElements);
    }

    const dataSql = `
      SELECT
        s.UDISE_CODE AS "udiseCode",
        s.SCHOOL_NAME AS "schoolName",
        s.STATE_NAME AS "stateName",
        s.DISTRICT_NAME AS "districtName",
        s.BLOCK_NAME AS "blockName",
        s.CLUSTER_NAME AS "clusterName",
        NVL(s.TOTAL_STUDENTS, 0) AS "totalStudents",
        NVL(s.TOTAL_TEACHERS, 0) AS "totalTeachers"
      FROM ${this.adwSchema}.SCHOOL s
      ${whereClause}
      ORDER BY s.SCHOOL_NAME
      OFFSET ${offset} ROWS FETCH NEXT ${size} ROWS ONLY
    `;

    const [countResult, dataResults] = await Promise.all([
      this.dataSource.query(countSql, params),
      this.dataSource.query(dataSql, params),
    ]);

    const totalElements = parseInt(countResult[0]?.total || '0', 10);
    return this.wrapPaginatedResponse(dataResults, page, size, totalElements);
  }

  async getTeachersDashboard(date: string, stateId?: string) {
    const params: any[] = [date];
    let stateJoin = '';
    let stateFilter = '';
    if (stateId) {
      stateJoin = `JOIN ${this.adwSchema}.SCHOOL s ON ta.UDISE_CODE = s.UDISE_CODE`;
      stateFilter = 'AND s.STATE_ID = :2';
      params.push(stateId);
    }

    const sql = `
      SELECT
        COUNT(DISTINCT ta.UDISE_CODE) AS "schoolsReporting",
        NVL(SUM(ta.TOTAL_TEACHERS_MARKED), 0) AS "totalTeachers",
        NVL(SUM(ta.TOTAL_TEACHERS_PRESENT), 0) AS "presentTeachers",
        NVL(SUM(ta.TOTAL_TEACHERS_ABSENT), 0) AS "absentTeachers",
        ROUND(
          NVL(SUM(ta.TOTAL_TEACHERS_PRESENT), 0) * 100.0 /
          NULLIF(NVL(SUM(ta.TOTAL_TEACHERS_MARKED), 0), 0), 2
        ) AS "attendancePercent"
      FROM ${this.attendanceSchema}.TEACHER_ATTENDANCE ta
      ${stateJoin}
      WHERE TRUNC(ta.ATTENDANCE_DATE) = TO_DATE(:1, 'YYYY-MM-DD')
      ${stateFilter}
    `;
    const results = await this.dataSource.query(sql, params);
    return this.wrapResponse(results[0] || {});
  }

  async getStudentsDashboard(date: string, stateId?: string) {
    const params: any[] = [date];
    let stateJoin = '';
    let stateFilter = '';
    if (stateId) {
      stateJoin = `JOIN ${this.adwSchema}.SCHOOL s ON sa.UDISE_CODE = s.UDISE_CODE`;
      stateFilter = 'AND s.STATE_ID = :2';
      params.push(stateId);
    }

    const sql = `
      SELECT
        COUNT(DISTINCT sa.UDISE_CODE) AS "schoolsReporting",
        NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) AS "presentStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0) AS "absentStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) + NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0) AS "totalStudents",
        ROUND(
          NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) * 100.0 /
          NULLIF(NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) + NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0), 0), 2
        ) AS "attendancePercent"
      FROM ${this.attendanceSchema}.STUDENT_ATTENDANCE sa
      ${stateJoin}
      WHERE TRUNC(sa.ATTENDANCE_DATE) = TO_DATE(:1, 'YYYY-MM-DD')
      ${stateFilter}
    `;
    const results = await this.dataSource.query(sql, params);
    return this.wrapResponse(results[0] || {});
  }

  async getSchoolManagementReport(
    date: string,
    stateId?: string,
    districtId?: string,
    blockId?: string,
    clusterId?: string,
  ) {
    const params: any[] = [date];
    const filters: string[] = [];

    if (stateId) {
      filters.push(`s.STATE_ID = :${params.length + 1}`);
      params.push(stateId);
    }
    if (districtId) {
      filters.push(`s.DISTRICT_ID = :${params.length + 1}`);
      params.push(districtId);
    }
    if (blockId) {
      filters.push(`s.BLOCK_ID = :${params.length + 1}`);
      params.push(blockId);
    }
    if (clusterId) {
      filters.push(`s.CLUSTER_ID = :${params.length + 1}`);
      params.push(clusterId);
    }

    const filterClause = filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';

    const sql = `
      SELECT
        NVL(s.SCHOOL_MANAGEMENT, 'Unknown') AS "managementType",
        COUNT(DISTINCT s.UDISE_CODE) AS "totalSchools",
        NVL(SUM(s.TOTAL_TEACHERS), 0) AS "totalTeachers",
        NVL(SUM(s.TOTAL_STUDENTS), 0) AS "totalStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) AS "presentStudents",
        NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0) AS "absentStudents",
        ROUND(
          NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) * 100.0 /
          NULLIF(NVL(SUM(sa.TOTAL_STUDENTS_PRESENT), 0) + NVL(SUM(sa.TOTAL_STUDENTS_ABSENT), 0), 0), 2
        ) AS "attendancePercent"
      FROM ${this.attendanceSchema}.STUDENT_ATTENDANCE sa
      JOIN ${this.adwSchema}.SCHOOL s ON sa.UDISE_CODE = s.UDISE_CODE
      WHERE TRUNC(sa.ATTENDANCE_DATE) = TO_DATE(:1, 'YYYY-MM-DD')
      ${filterClause}
      GROUP BY NVL(s.SCHOOL_MANAGEMENT, 'Unknown')
      ORDER BY "totalSchools" DESC
    `;
    const results = await this.dataSource.query(sql, params);
    return this.wrapResponse(results);
  }
}

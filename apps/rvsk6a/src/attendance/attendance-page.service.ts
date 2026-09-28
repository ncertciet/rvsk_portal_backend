import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedUser } from '@rvsk/common';

import { AttendanceQueryService } from './attendance-query.service';
import { AttendanceFiltersDto } from './dto/attendance-filters.dto';
import { AttendancePageData, UdiseRef } from './interfaces/dashboard';
import { ok, SuccessEnvelope } from './interfaces/responses';
import { applyScope, resolveScope, resolveNode } from './utils/scope.util';
import { page1Key, page1SchoolHashKey, GeoNode } from './utils/cache-key.util';

/**
 * Page 1 — Attendance summary (design.md §7 / §15.1).
 *
 * Reads the pre-computed Page-1 node blob from Redis:
 *   - a geography node (national/state/district/block/cluster) → att:v1:page1:{date}:{node}
 *   - a specific school (udiseCode)                            → HGET att:v1:page1school:{date} {udise}
 *
 * On a Redis miss: REDIS_ONLY=true → meta.empty; REDIS_ONLY=false → live MV
 * compute (dev), then warm the key.
 */
@Injectable()
export class AttendancePageService {
  private readonly logger = new Logger(AttendancePageService.name);

  constructor(private readonly q: AttendanceQueryService) {}

  async getAttendancePage(
    filters: AttendanceFiltersDto,
    user: AuthenticatedUser,
  ): Promise<SuccessEnvelope<AttendancePageData | null>> {
    const scope = resolveScope(user);
    const merged = applyScope(scope, filters);
    const date = filters.date ?? this.q.todayISO();
    const node = resolveNode(merged);

    // School selection → school hash field; otherwise the node snapshot.
    const cached = merged.udiseCode
      ? await this.q.get<AttendancePageData>(
          // stored as a HASH; CacheService has no HGET, so schools are stored as
          // discrete keys under the same date namespace for the API read path.
          `${page1SchoolHashKey(date)}:${merged.udiseCode}`,
        )
      : await this.q.get<AttendancePageData>(page1Key(date, node as GeoNode));

    if (cached) {
      return ok(cached, {
        asOfDate: cached.asOfDate ?? date,
        scopeLevel: scope.level,
        cached: true,
      });
    }

    // Miss.
    if (this.q.redisOnly) {
      return ok(null, { asOfDate: date, scopeLevel: scope.level, cached: false, empty: true });
    }

    // Dev fallback: compute live from the MVs.
    const computed = await this.computeFromMvs(date, node, merged.udiseCode);
    if (!computed) {
      return ok(null, { asOfDate: date, scopeLevel: scope.level, cached: false, empty: true });
    }
    const keyToWarm = merged.udiseCode
      ? `${page1SchoolHashKey(date)}:${merged.udiseCode}`
      : page1Key(date, node as GeoNode);
    await this.q.set(keyToWarm, computed);
    return ok(computed, { asOfDate: date, scopeLevel: scope.level, cached: false });
  }

  /**
   * Dev-only live compute from the Oracle MVs (design.md §16 read patterns).
   * Mirrors exactly what the cron populator produces, so dev and prod render the
   * same shape. Not used when REDIS_ONLY=true.
   */
  private async computeFromMvs(
    date: string,
    node: ReturnType<typeof resolveNode>,
    udiseCode?: string,
  ): Promise<AttendancePageData | null> {
    if (udiseCode) {
      // Single-school dev compute is out of scope for the fallback; the school
      // hash is a cron artefact. Return null → meta.empty in dev for a school.
      return null;
    }

    // Attendance query binds date at :1, node key (if any) at :2.
    const attWhere = this.nodeWhere(node, 'g', 2);
    const attSql = `
      SELECT
        NVL(SUM(g.STU_PRESENT),0)  AS "stuPresent",
        NVL(SUM(g.STU_ABSENT),0)   AS "stuAbsent",
        NVL(SUM(g.TCH_MARKED),0)   AS "tchMarked",
        NVL(SUM(g.TCH_PRESENT),0)  AS "tchPresent",
        NVL(SUM(g.TCH_ABSENT),0)   AS "tchAbsent",
        NVL(SUM(g.TCH_ON_DUTY),0)  AS "tchOnDuty",
        NVL(SUM(g.SCHOOLS_REPORTING_STUDENT),0) AS "schReportingStudent",
        NVL(SUM(g.SCHOOLS_REPORTING_TEACHER),0) AS "schReportingTeacher"
      FROM ${this.q.schema}.MV_ATT_GEO_DAY g
      WHERE g.ATTENDANCE_DATE = TO_DATE(:1,'YYYY-MM-DD') ${attWhere.frag}`;

    // Census query binds node key (if any) at :1.
    const censusWhere = this.nodeWhere(node, 'a', 1);
    const censusSql = `
      SELECT
        NVL(SUM(a.ACTIVE_SCHOOLS),0)      AS "activeSchools",
        NVL(SUM(a.RVSK_TOTAL_STUDENTS),0) AS "rvskStudents",
        NVL(SUM(a.RVSK_TOTAL_TEACHERS),0) AS "rvskTeachers"
      FROM ${this.q.schema}.MV_GEO_ACTIVE_SCHOOLS a
      WHERE 1=1 ${censusWhere.frag}`;

    // Coverage — expected = distinct active child geos in scope (census),
    // reported = distinct child geos with any attendance on the date.
    const covExpectedSql = `
      SELECT
        COUNT(DISTINCT a.STATE_KEY)    AS "states",
        COUNT(DISTINCT a.DISTRICT_KEY) AS "districts",
        COUNT(DISTINCT a.BLOCK_KEY)    AS "blocks"
      FROM ${this.q.schema}.MV_GEO_ACTIVE_SCHOOLS a
      WHERE 1=1 ${censusWhere.frag}`;
    const covReportedSql = `
      SELECT
        COUNT(DISTINCT g.STATE_KEY)    AS "states",
        COUNT(DISTINCT g.DISTRICT_KEY) AS "districts",
        COUNT(DISTINCT g.BLOCK_KEY)    AS "blocks"
      FROM ${this.q.schema}.MV_ATT_GEO_DAY g
      WHERE g.ATTENDANCE_DATE = TO_DATE(:1,'YYYY-MM-DD') ${attWhere.frag}`;

    // UDISE 25-26 static reference — national row (STATE_KEY NULL) or per-state;
    // null below State.
    const udiseRefPromise = this.loadUdiseRef(node);

    const [attRows, censusRows, covExpRows, covRepRows, udiseRef] = await Promise.all([
      this.q.query(attSql, [date, ...attWhere.binds]),
      this.q.query(censusSql, censusWhere.binds),
      this.q.query(covExpectedSql, censusWhere.binds),
      this.q.query(covReportedSql, [date, ...attWhere.binds]),
      udiseRefPromise,
    ]);
    const a = attRows[0];
    const c = censusRows[0];
    if (!a || !c) return null;
    const covExp = covExpRows[0] ?? {};
    const covRep = covRepRows[0] ?? {};

    const num = (v: any) => Number(v ?? 0);
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n * 10000) / d) / 100 : 0);

    const stuPresent = num(a.stuPresent);
    const stuAbsent = num(a.stuAbsent);
    const stuMarked = stuPresent + stuAbsent;
    const tchMarked = num(a.tchMarked);
    const tchPresent = num(a.tchPresent);
    const tchAbsent = num(a.tchAbsent);
    const tchOnDuty = num(a.tchOnDuty);
    const activeSchools = num(c.activeSchools);
    const rvskStudents = num(c.rvskStudents);
    const rvskTeachers = num(c.rvskTeachers);
    const schReportingStudent = num(a.schReportingStudent);
    const schReportingTeacher = num(a.schReportingTeacher);

    return {
      asOfDate: date,
      scopeLevel: node.level === 'national' ? 'national' : node.level === 'state' ? 'state' : 'district',
      integrationCoverage: {
        states: { reported: num(covRep.states), expected: num(covExp.states) },
        districts: { reported: num(covRep.districts), expected: num(covExp.districts) },
        blocks: { reported: num(covRep.blocks), expected: num(covExp.blocks) },
      },
      integrationStatus: {
        udiseRef,
        rvskMaster: { schools: activeSchools, teachers: rvskTeachers, students: rvskStudents },
        onboarded: { schools: activeSchools, teachers: rvskTeachers, students: rvskStudents },
        yetToOnboard: { schools: 0, teachers: 0, students: 0 },
      },
      schoolIntegration: {
        onboarded: activeSchools,
        reportingTeacher: schReportingTeacher,
        reportingStudent: schReportingStudent,
      },
      teacher: {
        totalInSchools: rvskTeachers,
        totalReported: tchMarked,
        reportedPct: pct(tchMarked, rvskTeachers),
        present: tchPresent,
        absent: tchAbsent,
        onDuty: tchOnDuty,
        presentPct: pct(tchPresent, tchMarked),
        absentPct: pct(tchAbsent, tchMarked),
        onDutyPct: pct(tchOnDuty, tchMarked),
      },
      student: {
        totalInSchools: rvskStudents,
        totalReported: stuMarked,
        reportedPct: pct(schReportingStudent, activeSchools),
        present: stuPresent,
        absent: stuAbsent,
        presentPct: pct(stuPresent, stuMarked),
        absentPct: pct(stuAbsent, stuMarked),
      },
    };
  }

  /**
   * Positional WHERE fragment + binds for the resolved node, for table alias
   * `alias`, with the first bind at position `bindStart`.
   */
  private nodeWhere(
    node: ReturnType<typeof resolveNode>,
    alias: string,
    bindStart: number,
  ): { frag: string; binds: any[] } {
    const col: Record<string, string> = {
      state: 'STATE_KEY',
      district: 'DISTRICT_KEY',
      block: 'BLOCK_KEY',
      cluster: 'CLUSTER_KEY',
    };
    if (node.level === 'national') return { frag: '', binds: [] };
    return {
      frag: `AND ${alias}.${col[node.level]} = :${bindStart}`,
      binds: [node.key],
    };
  }

  /**
   * UDISE 25-26 static reference for the node: national row (STATE_KEY NULL) for
   * the national node, the per-state row for a state node, null below State.
   */
  private async loadUdiseRef(node: ReturnType<typeof resolveNode>): Promise<UdiseRef | null> {
    if (node.level !== 'national' && node.level !== 'state') return null;

    const where =
      node.level === 'national'
        ? 'u.STATE_KEY IS NULL'
        : 'u.STATE_KEY = :1';
    const binds = node.level === 'national' ? [] : [node.key];
    const sql = `
      SELECT u.GRAIN "grain", u.TOTAL_SCHOOLS "sc", u.TOTAL_TEACHERS "tch", u.TOTAL_STUDENTS "stu"
      FROM ${this.q.schema}.VW_UDISE_STATIC_DATA u
      WHERE u.ACADEMIC_YEAR = '2025-26' AND ${where}`;
    const rows = await this.q.query(sql, binds);
    const r = rows[0];
    if (!r) return null;
    return {
      grain: (r.grain as 'NATIONAL' | 'STATE') ?? null,
      schools: Number(r.sc ?? 0),
      teachers: Number(r.tch ?? 0),
      students: Number(r.stu ?? 0),
    };
  }
}

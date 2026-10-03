import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedUser } from '@rvsk/common';

import { AttendanceQueryService } from './attendance-query.service';
import { AttendanceFiltersDto } from './dto/attendance-filters.dto';
import { StudentBreakdownData, StudentBreakdownBar } from './interfaces/dashboard';
import { ok, SuccessEnvelope } from './interfaces/responses';
import { applyScope, resolveScope, resolveNode, ResolvedNode } from './utils/scope.util';

/**
 * Page-1 Student breakdown bars (requirement E) — class / gender / category
 * attendance snapshot for the selected date + node. Gender and category are
 * INDEPENDENT datasets (never linked). Served from Redis
 * (att:v1:studentbreak:{node}:{date}); REDIS_ONLY miss → empty; dev → live MV
 * compute + cache-through. School leaf (udiseCode) always computes live:
 * gender/category from MV_ATT_SCHOOL_DAY, class from VW_STUDENT_ATTENDANCE_V2.
 */
@Injectable()
export class AttendanceStudentService {
  private readonly logger = new Logger(AttendanceStudentService.name);

  // Gender/category present/absent column pairs (shared by geo + school).
  private readonly GENDER: [string, string, string][] = [
    ['Male', 'MALE_PRESENT', 'MALE_ABSENT'],
    ['Female', 'FEMALE_PRESENT', 'FEMALE_ABSENT'],
    ['Others', 'OTHERS_PRESENT', 'OTHERS_ABSENT'],
  ];
  private readonly CATEGORY: [string, string, string][] = [
    ['General', 'GENERAL_PRESENT', 'GENERAL_ABSENT'],
    ['SC', 'SC_PRESENT', 'SC_ABSENT'],
    ['ST', 'ST_PRESENT', 'ST_ABSENT'],
    ['OBC', 'OBC_PRESENT', 'OBC_ABSENT'],
  ];

  constructor(private readonly q: AttendanceQueryService) {}

  async getStudentBreakdown(
    filters: AttendanceFiltersDto,
    user: AuthenticatedUser,
  ): Promise<SuccessEnvelope<StudentBreakdownData | null>> {
    const scope = resolveScope(user);
    const merged = applyScope(scope, filters);
    const date = filters.date ?? (await this.q.latestDataDate());
    const node = resolveNode(merged);

    // School leaf → always live (option b), cache-through. bypass skips the read.
    if (merged.udiseCode) {
      const key = `att:v1:studentbreak:school:${merged.udiseCode}:${date}`;
      if (!this.q.bypassRedis) {
        const hit = await this.q.get<StudentBreakdownData>(key);
        if (hit) return ok(hit, { asOfDate: date, scopeLevel: scope.level, cached: true });
      }
      const data = await this.computeSchool(date, merged.udiseCode);
      if (!data) return ok(null, { asOfDate: date, scopeLevel: scope.level, cached: false, empty: true });
      if (!this.q.bypassRedis) await this.q.set(key, data);
      return ok(data, { asOfDate: date, scopeLevel: scope.level, cached: false });
    }

    // Geo node → Redis blob. bypass skips the read and always computes from ADW.
    const key = `att:v1:studentbreak:${this.nodeSeg(node)}:${date}`;
    if (!this.q.bypassRedis) {
      const cached = await this.q.get<StudentBreakdownData>(key);
      if (cached) return ok(cached, { asOfDate: date, scopeLevel: scope.level, cached: true });
      if (this.q.redisOnly) {
        return ok(null, { asOfDate: date, scopeLevel: scope.level, cached: false, empty: true });
      }
    }
    const data = await this.computeGeo(date, node);
    if (!data) return ok(null, { asOfDate: date, scopeLevel: scope.level, cached: false, empty: true });
    if (!this.q.bypassRedis) await this.q.set(key, data);
    return ok(data, { asOfDate: date, scopeLevel: scope.level, cached: false });
  }

  private nodeSeg(node: ResolvedNode): string {
    return node.level === 'national' ? 'national' : `${node.level}:${node.key}`;
  }

  private pct(n: number, d: number): number {
    return d > 0 ? Math.round((n * 10000) / d) / 100 : 0;
  }

  private toBars(row: any, defs: [string, string, string][]): StudentBreakdownBar[] {
    return defs.map(([label, p, a]) => {
      const present = Number(row?.[p] ?? 0);
      const absent = Number(row?.[a] ?? 0);
      return { label, present, absent, pct: this.pct(present, present + absent) };
    });
  }

  // ── Geo node compute ────────────────────────────────────────────────────────
  private async computeGeo(date: string, node: ResolvedNode): Promise<StudentBreakdownData | null> {
    const parent = this.parentFilter(node);

    // Gender + category: single aggregated row from MV_ATT_GEO_DAY for the node.
    const gcCols = [...this.GENDER, ...this.CATEGORY]
      .flatMap(([, p, a]) => [p, a])
      .map((c) => `NVL(SUM(${c}),0) AS "${c}"`)
      .join(', ');
    const gcSql = `
      SELECT ${gcCols}
      FROM ${this.q.schema}.MV_ATT_GEO_DAY g
      WHERE g.ATTENDANCE_DATE = TO_DATE(:1,'YYYY-MM-DD') ${parent.frag('g', 2)}`;

    // Class: grouped by GRADE from the grade MV.
    const classSql = `
      SELECT g.GRADE AS "grade",
             NVL(SUM(g.STU_PRESENT),0) AS "p",
             NVL(SUM(g.STU_ABSENT),0)  AS "a"
      FROM ${this.q.schema}.MV_ATT_GEO_DAY_GRADE g
      WHERE g.ATTENDANCE_DATE = TO_DATE(:1,'YYYY-MM-DD') ${parent.frag('g', 2)}
      GROUP BY g.GRADE`;

    const [gcRows, classRows] = await Promise.all([
      this.q.query(gcSql, [date, ...parent.binds]),
      this.q.query(classSql, [date, ...parent.binds]),
    ]);

    const gc = gcRows[0] ?? {};
    return {
      byClass: this.classBars(classRows),
      byGender: this.toBars(gc, this.GENDER),
      byCategory: this.toBars(gc, this.CATEGORY),
    };
  }

  // ── School leaf compute ──────────────────────────────────────────────────────
  private async computeSchool(date: string, udiseCode: string): Promise<StudentBreakdownData | null> {
    // Gender/category from the school-day fact (one row).
    const gcCols = [...this.GENDER, ...this.CATEGORY]
      .flatMap(([, p, a]) => [p, a])
      .map((c) => `NVL(${c},0) AS "${c}"`)
      .join(', ');
    const gcSql = `
      SELECT ${gcCols}
      FROM ${this.q.schema}.MV_ATT_SCHOOL_DAY
      WHERE UDISE_CODE = :1 AND ATTENDANCE_DATE = TO_DATE(:2,'YYYY-MM-DD')`;

    // Class from the raw V2 view by GRADE (indexed on UDISE_CODE).
    const classSql = `
      SELECT GRADE AS "grade",
             NVL(SUM(NVL(MALE_PRESENT,0)+NVL(FEMALE_PRESENT,0)+NVL(TRANSGENDER_PRESENT,0)),0) AS "p",
             NVL(SUM(NVL(MALE_ABSENT,0) +NVL(FEMALE_ABSENT,0) +NVL(TRANSGENDER_ABSENT,0)),0)  AS "a"
      FROM ${this.q.schema}.VW_STUDENT_ATTENDANCE_V2
      WHERE UDISE_CODE = :1 AND ATTENDANCE_DATE = TO_DATE(:2,'YYYY-MM-DD')
      GROUP BY GRADE`;

    const [gcRows, classRows] = await Promise.all([
      this.q.query(gcSql, [udiseCode, date]),
      this.q.query(classSql, [udiseCode, date]),
    ]);

    const gc = gcRows[0];
    if (!gc && classRows.length === 0) {
      // No student attendance for this school on this date.
      return { byClass: [], byGender: this.toBars({}, this.GENDER), byCategory: this.toBars({}, this.CATEGORY) };
    }
    return {
      byClass: this.classBars(classRows),
      byGender: this.toBars(gc ?? {}, this.GENDER),
      byCategory: this.toBars(gc ?? {}, this.CATEGORY),
    };
  }

  /** Build Class 1..12 bars from grouped-by-GRADE rows (sorted by grade). */
  private classBars(rows: any[]): StudentBreakdownBar[] {
    const byGrade = new Map<number, { p: number; a: number }>();
    for (const r of rows) {
      const g = Number(r.grade);
      if (!Number.isFinite(g)) continue;
      const e = byGrade.get(g) ?? { p: 0, a: 0 };
      e.p += Number(r.p ?? 0);
      e.a += Number(r.a ?? 0);
      byGrade.set(g, e);
    }
    return [...byGrade.entries()]
      .sort(([x], [y]) => x - y)
      .map(([g, e]) => ({
        label: `Class ${g}`,
        present: e.p,
        absent: e.a,
        pct: this.pct(e.p, e.p + e.a),
      }));
  }

  private parentFilter(node: ResolvedNode): {
    frag: (alias: string, bindStart: number) => string;
    binds: any[];
  } {
    const col: Record<string, string> = {
      state: 'STATE_KEY', district: 'DISTRICT_KEY', block: 'BLOCK_KEY', cluster: 'CLUSTER_KEY',
    };
    if (node.level === 'national') return { frag: () => '', binds: [] };
    const c = col[node.level];
    return {
      frag: (alias: string, bindStart: number) => `AND ${alias ? alias + '.' : ''}${c} = :${bindStart}`,
      binds: [node.key],
    };
  }
}

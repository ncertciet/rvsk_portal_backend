import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedUser } from '@rvsk/common';

import { AttendanceQueryService } from './attendance-query.service';
import { AttendanceTrendDto } from './dto/attendance-trend.dto';
import {
  TrendData,
  TrendGranularity,
  ReportedPoint,
  ValuePoint,
  OverallPresentPoint,
  DailyCountPoint,
  StudentOverallSeriesBlob,
  TeacherSeriesBlob,
  DimensionSeriesBlob,
} from './interfaces/dashboard';
import { ok, SuccessEnvelope } from './interfaces/responses';
import { applyScope, resolveScope, resolveNode, ResolvedNode } from './utils/scope.util';
import { seriesKey, GeoNode } from './utils/cache-key.util';

const DAY_MS = 86_400_000;

/**
 * Page 2 — Trends (design.md §8 / §15.2).
 *
 * Reads ONE ~6-month daily-series blob per node per stream from Redis, then
 * slices (30D / custom) and weekly-buckets (3M / 6M / long custom) IN NODE. One
 * blob powers every range → no per-range keys (D-3). Weighting: bucket % =
 * SUM(present)/SUM(present+absent) over the bucket (§3.4), computed from the raw
 * daily counts in the blob.
 *
 * Custom ranges are hard-clamped to the last `ATTENDANCE_SERIES_MONTHS` months
 * server-side; the client bound is never trusted.
 */
@Injectable()
export class AttendanceTrendsService {
  private readonly logger = new Logger(AttendanceTrendsService.name);

  constructor(private readonly q: AttendanceQueryService) {}

  async getTrend(
    dto: AttendanceTrendDto,
    user: AuthenticatedUser,
  ): Promise<SuccessEnvelope<TrendData | null>> {
    const scope = resolveScope(user);
    const merged = applyScope(scope, dto);
    const node = resolveNode(merged);

    // Trends end at the latest date WITH data (requirement B2), not today.
    const anchor = await this.q.latestDataDate();
    const { from, to } = this.resolveWindow(dto, anchor);
    const spanDays = Math.round((this.parse(to) - this.parse(from)) / DAY_MS);
    const granularity: TrendGranularity = spanDays > 45 ? 'weekly' : 'daily';
    const dimension = dto.dimension ?? 'overall';
    const rangeLabel = dto.range ?? `${from}..${to}`;

    // ── School leaf (option b): that school's OWN windowed trend, computed
    // on-demand (allowed under REDIS_ONLY) + cache-through. (requirement F4) ────
    if (merged.udiseCode) {
      const key = `att:v1:trend:school:${merged.udiseCode}:${from}:${to}:${dimension}`;
      if (!this.q.bypassRedis) {
        const hit = await this.q.get<TrendData>(key);
        if (hit) return ok(hit, { scopeLevel: scope.level, cached: true, asOfDate: to });
      }
      const data = await this.computeSchoolTrend(
        merged.udiseCode, from, to, dimension, granularity, rangeLabel,
      );
      if (!data) return ok(null, { scopeLevel: scope.level, cached: false, empty: true });
      if (!this.q.bypassRedis) await this.q.set(key, data);
      return ok(data, { scopeLevel: scope.level, cached: false, asOfDate: to });
    }

    // bypass mode: skip Redis entirely and compute the geo series from MVs.
    if (this.q.bypassRedis) {
      const computed = await this.computeFromMvs(node, from, to, dimension, granularity, rangeLabel);
      return ok(computed, { scopeLevel: scope.level, cached: false, ...(computed ? {} : { empty: true }) });
    }

    // Always need overall (reported card + overall present) + teacher.
    const overallBlob = await this.q.get<StudentOverallSeriesBlob>(
      seriesKey(node as GeoNode, 'student:overall'),
    );
    const teacherBlob = await this.q.get<TeacherSeriesBlob>(
      seriesKey(node as GeoNode, 'teacher'),
    );

    if (!overallBlob || !teacherBlob) {
      if (this.q.redisOnly) {
        return ok(null, { scopeLevel: scope.level, cached: false, empty: true });
      }
      // Dev fallback: compute the series live from the MVs.
      const computed = await this.computeFromMvs(node, from, to, dimension, granularity, rangeLabel);
      return ok(computed, { scopeLevel: scope.level, cached: false, ...(computed ? {} : { empty: true }) });
    }

    const data = this.assemble(
      overallBlob,
      teacherBlob,
      dimension === 'overall'
        ? null
        : await this.q.get<DimensionSeriesBlob>(seriesKey(node as GeoNode, `student:${dimension}`)),
      dimension,
      from,
      to,
      granularity,
      rangeLabel,
    );
    return ok(data, { scopeLevel: scope.level, cached: true, asOfDate: to });
  }

  // ── Window resolution + 6-month clamp ─────────────────────────────────────────
  // `anchorISO` is the latest date WITH data; the window ends there (not today),
  // and presets count back from it (requirement B2).
  private resolveWindow(dto: AttendanceTrendDto, anchorISO: string): { from: string; to: string } {
    const toISO = (d: Date) => d.toISOString().slice(0, 10);
    const anchor = new Date(anchorISO);
    const minAllowed = new Date(anchor);
    minAllowed.setMonth(minAllowed.getMonth() - this.q.seriesMonths);

    // Preset ranges win when no explicit custom range is given.
    if (dto.range && !(dto.fromDate && dto.toDate)) {
      const from = new Date(anchor);
      if (dto.range === '30D') from.setDate(from.getDate() - 30);
      else if (dto.range === '3M') from.setMonth(from.getMonth() - 3);
      else if (dto.range === '6M') from.setMonth(from.getMonth() - 6);
      return { from: toISO(from), to: anchorISO };
    }

    // Custom range — clamp both ends into [minAllowed, anchor].
    let from = dto.fromDate ? new Date(dto.fromDate) : new Date(minAllowed);
    let to = dto.toDate ? new Date(dto.toDate) : new Date(anchor);
    if (from < minAllowed) from = new Date(minAllowed);
    if (to > anchor) to = new Date(anchor);
    if (from > to) from = new Date(to);
    return { from: toISO(from), to: toISO(to) };
  }

  // ── Assemble the response from the stored blobs ──────────────────────────────
  private assemble(
    overall: StudentOverallSeriesBlob,
    teacher: TeacherSeriesBlob,
    dim: DimensionSeriesBlob | null,
    dimension: string,
    from: string,
    to: string,
    granularity: TrendGranularity,
    rangeLabel: string,
  ): TrendData {
    const inWin = (d: string) => d >= from && d <= to;

    // Reported (participation %) — teacher & student per period.
    const stuReported = overall.reported.filter((p) => inWin(p.d));
    const tchDaily = teacher.daily.filter((p) => inWin(p.d));
    const reported = this.bucketReported(stuReported, tchDaily, granularity);

    // Present overall — teacher & student %.
    const stuPresentDaily = overall.present.filter((p) => inWin(p.d));
    const tchPresentDaily = tchDaily.map<DailyCountPoint>((p) => ({
      d: p.d,
      present: p.present,
      absent: Math.max(0, p.marked - p.present), // marked includes on-duty; "present of marked"
    }));
    const overallPresent = this.bucketOverall(stuPresentDaily, tchPresentDaily, granularity);

    const present: TrendData['present'] = { overall: overallPresent };

    if (dim && dimension !== 'overall') {
      const bucketed: Record<string, ValuePoint[]> = {};
      for (const [k, arr] of Object.entries(dim.series)) {
        bucketed[k] = this.bucketValue(arr.filter((p) => inWin(p.d)), granularity);
      }
      if (dimension === 'class') present.byClass = bucketed;
      else if (dimension === 'gender') present.byGender = bucketed as any;
      else if (dimension === 'category') present.byCategory = bucketed as any;
    }

    return { granularity, range: rangeLabel, reported, present };
  }

  // ── Bucketing helpers (weighted by counts; §3.4) ─────────────────────────────
  private periodKey(d: string, granularity: TrendGranularity): string {
    if (granularity === 'daily') return d;
    // ISO-week bucket: label by the week's Monday.
    const date = new Date(d);
    const day = (date.getUTCDay() + 6) % 7; // 0 = Monday
    date.setUTCDate(date.getUTCDate() - day);
    return date.toISOString().slice(0, 10);
  }

  private bucketReported(
    stu: { d: string; reportingSchools: number; activeSchools: number }[],
    tch: { d: string; reportingSchools: number; activeSchools: number }[],
    g: TrendGranularity,
  ): ReportedPoint[] {
    const acc = new Map<string, { sr: number; sa: number; tr: number; ta: number }>();
    for (const p of stu) {
      const k = this.periodKey(p.d, g);
      const e = acc.get(k) ?? { sr: 0, sa: 0, tr: 0, ta: 0 };
      e.sr += p.reportingSchools; e.sa += p.activeSchools; acc.set(k, e);
    }
    for (const p of tch) {
      const k = this.periodKey(p.d, g);
      const e = acc.get(k) ?? { sr: 0, sa: 0, tr: 0, ta: 0 };
      e.tr += p.reportingSchools; e.ta += p.activeSchools; acc.set(k, e);
    }
    return [...acc.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([period, e]) => ({
        period,
        teacher: this.pct(e.tr, e.ta),
        student: this.pct(e.sr, e.sa),
      }));
  }

  private bucketOverall(
    stu: DailyCountPoint[],
    tch: DailyCountPoint[],
    g: TrendGranularity,
  ): OverallPresentPoint[] {
    const acc = new Map<string, { sp: number; sm: number; tp: number; tm: number }>();
    for (const p of stu) {
      const k = this.periodKey(p.d, g);
      const e = acc.get(k) ?? { sp: 0, sm: 0, tp: 0, tm: 0 };
      e.sp += p.present; e.sm += p.present + p.absent; acc.set(k, e);
    }
    for (const p of tch) {
      const k = this.periodKey(p.d, g);
      const e = acc.get(k) ?? { sp: 0, sm: 0, tp: 0, tm: 0 };
      e.tp += p.present; e.tm += p.present + p.absent; acc.set(k, e);
    }
    return [...acc.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([period, e]) => ({
        period,
        teacher: this.pct(e.tp, e.tm),
        student: this.pct(e.sp, e.sm),
      }));
  }

  private bucketValue(arr: DailyCountPoint[], g: TrendGranularity): ValuePoint[] {
    const acc = new Map<string, { p: number; m: number }>();
    for (const p of arr) {
      const k = this.periodKey(p.d, g);
      const e = acc.get(k) ?? { p: 0, m: 0 };
      e.p += p.present; e.m += p.present + p.absent; acc.set(k, e);
    }
    return [...acc.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([period, e]) => ({ period, value: this.pct(e.p, e.m) }));
  }

  private pct(n: number, d: number): number {
    return d > 0 ? Math.round((n * 10000) / d) / 100 : 0;
  }

  private parse(iso: string): number {
    return new Date(iso).getTime();
  }

  // ── Dev fallback: compute the windowed series live from the MVs ──────────────
  private async computeFromMvs(
    node: ResolvedNode,
    from: string,
    to: string,
    dimension: string,
    granularity: TrendGranularity,
    rangeLabel: string,
  ): Promise<TrendData | null> {
    // Overall + teacher + reporting counts per day for the node.
    const where = this.nodeWhere(node, 'g', 3);
    const sql = `
      SELECT TO_CHAR(g.ATTENDANCE_DATE,'YYYY-MM-DD') AS "d",
             NVL(SUM(g.STU_PRESENT),0) AS "sp",
             NVL(SUM(g.STU_ABSENT),0)  AS "sa",
             NVL(SUM(g.TCH_PRESENT),0) AS "tp",
             NVL(SUM(g.TCH_MARKED),0)  AS "tm",
             NVL(SUM(g.SCHOOLS_REPORTING_STUDENT),0) AS "srs",
             NVL(SUM(g.SCHOOLS_REPORTING_TEACHER),0) AS "srt"
      FROM ${this.q.schema}.MV_ATT_GEO_DAY g
      WHERE g.ATTENDANCE_DATE BETWEEN TO_DATE(:1,'YYYY-MM-DD') AND TO_DATE(:2,'YYYY-MM-DD')
        ${where.frag}
      GROUP BY g.ATTENDANCE_DATE ORDER BY g.ATTENDANCE_DATE`;

    // Active-school denominator for the node (point-in-time snapshot).
    const cWhere = this.nodeWhere(node, 'a', 1);
    const censusSql = `
      SELECT NVL(SUM(a.ACTIVE_SCHOOLS),0) AS "act"
      FROM ${this.q.schema}.MV_GEO_ACTIVE_SCHOOLS a
      WHERE 1=1 ${cWhere.frag}`;

    const [rows, censusRows] = await Promise.all([
      this.q.query(sql, [from, to, ...where.binds]),
      this.q.query(censusSql, cWhere.binds),
    ]);
    if (!rows.length) return null;
    const activeSchools = Number(censusRows[0]?.act ?? 0);

    const stu: DailyCountPoint[] = rows.map((r: any) => ({
      d: r.d, present: Number(r.sp), absent: Number(r.sa),
    }));
    const tch: DailyCountPoint[] = rows.map((r: any) => ({
      d: r.d, present: Number(r.tp), absent: Math.max(0, Number(r.tm) - Number(r.tp)),
    }));

    // Reported (participation %): reporting schools / active schools, per day,
    // bucketed weighted by the shared active-school denominator.
    const stuReported = rows.map((r: any) => ({
      d: r.d, reportingSchools: Number(r.srs), activeSchools,
    }));
    const tchReported = rows.map((r: any) => ({
      d: r.d, reportingSchools: Number(r.srt), activeSchools,
    }));
    const reported = this.bucketReported(stuReported, tchReported, granularity);

    const present: TrendData['present'] = { overall: this.bucketOverall(stu, tch, granularity) };

    // Dimensioned series for the requested dimension.
    if (dimension === 'gender' || dimension === 'category') {
      present[dimension === 'gender' ? 'byGender' : 'byCategory'] =
        (await this.computeGenderCategoryFromMvs(node, from, to, dimension, granularity)) as any;
    } else if (dimension === 'class') {
      present.byClass = await this.computeClassFromMvs(node, from, to, granularity);
    }

    return { granularity, range: rangeLabel, reported, present };
  }

  /** Gender/category daily series from MV_ATT_GEO_DAY columns, bucketed. */
  private async computeGenderCategoryFromMvs(
    node: ResolvedNode,
    from: string,
    to: string,
    dimension: 'gender' | 'category',
    granularity: TrendGranularity,
  ): Promise<Record<string, ValuePoint[]>> {
    const where = this.nodeWhere(node, 'g', 3);
    const cols =
      dimension === 'gender'
        ? { male: ['MALE_PRESENT', 'MALE_ABSENT'], female: ['FEMALE_PRESENT', 'FEMALE_ABSENT'], others: ['OTHERS_PRESENT', 'OTHERS_ABSENT'] }
        : {
            general: ['GENERAL_PRESENT', 'GENERAL_ABSENT'],
            sc: ['SC_PRESENT', 'SC_ABSENT'],
            st: ['ST_PRESENT', 'ST_ABSENT'],
            obc: ['OBC_PRESENT', 'OBC_ABSENT'],
          };
    const selects = Object.entries(cols)
      .map(([k, [p, ab]]) => `NVL(SUM(g.${p}),0) AS "${k}_p", NVL(SUM(g.${ab}),0) AS "${k}_a"`)
      .join(',\n             ');
    const sql = `
      SELECT TO_CHAR(g.ATTENDANCE_DATE,'YYYY-MM-DD') AS "d",
             ${selects}
      FROM ${this.q.schema}.MV_ATT_GEO_DAY g
      WHERE g.ATTENDANCE_DATE BETWEEN TO_DATE(:1,'YYYY-MM-DD') AND TO_DATE(:2,'YYYY-MM-DD')
        ${where.frag}
      GROUP BY g.ATTENDANCE_DATE ORDER BY g.ATTENDANCE_DATE`;
    const rows = await this.q.query(sql, [from, to, ...where.binds]);

    const out: Record<string, ValuePoint[]> = {};
    for (const k of Object.keys(cols)) {
      const daily: DailyCountPoint[] = rows.map((r: any) => ({
        d: r.d, present: Number(r[`${k}_p`]), absent: Number(r[`${k}_a`]),
      }));
      out[k] = this.bucketValue(daily, granularity);
    }
    return out;
  }

  /** Per-class daily series from MV_ATT_GEO_DAY_GRADE, bucketed. */
  private async computeClassFromMvs(
    node: ResolvedNode,
    from: string,
    to: string,
    granularity: TrendGranularity,
  ): Promise<Record<string, ValuePoint[]>> {
    const where = this.nodeWhere(node, 'g', 3);
    const sql = `
      SELECT TO_CHAR(g.ATTENDANCE_DATE,'YYYY-MM-DD') AS "d",
             g.GRADE AS "grade",
             NVL(SUM(g.STU_PRESENT),0) AS "p",
             NVL(SUM(g.STU_ABSENT),0)  AS "a"
      FROM ${this.q.schema}.MV_ATT_GEO_DAY_GRADE g
      WHERE g.ATTENDANCE_DATE BETWEEN TO_DATE(:1,'YYYY-MM-DD') AND TO_DATE(:2,'YYYY-MM-DD')
        ${where.frag}
      GROUP BY g.ATTENDANCE_DATE, g.GRADE ORDER BY g.ATTENDANCE_DATE`;
    const rows = await this.q.query(sql, [from, to, ...where.binds]);

    const byGrade = new Map<string, DailyCountPoint[]>();
    for (const r of rows as any[]) {
      const g = String(r.grade);
      const arr = byGrade.get(g) ?? [];
      arr.push({ d: r.d, present: Number(r.p), absent: Number(r.a) });
      byGrade.set(g, arr);
    }
    const out: Record<string, ValuePoint[]> = {};
    for (const [g, daily] of byGrade) out[g] = this.bucketValue(daily, granularity);
    return out;
  }

  private nodeWhere(node: ResolvedNode, alias: string, bindStart: number): { frag: string; binds: any[] } {
    const col: Record<string, string> = {
      state: 'STATE_KEY', district: 'DISTRICT_KEY', block: 'BLOCK_KEY', cluster: 'CLUSTER_KEY',
    };
    if (node.level === 'national') return { frag: '', binds: [] };
    return { frag: `AND ${alias}.${col[node.level]} = :${bindStart}`, binds: [node.key] };
  }

  // ── School-leaf windowed trend (requirement F4) ──────────────────────────────
  // That school's OWN attendance over the window. Overall/gender/category/teacher
  // from MV_ATT_SCHOOL_DAY (indexed on UDISE+DATE); class from the raw V2 view by
  // GRADE. Card 1 "reported" at school = the school's own present % (teacher &
  // student) — not a coverage ratio (per product owner: show the school's real
  // attendance trend). Bucketed daily (≤45d) or weekly (ISO week).
  private async computeSchoolTrend(
    udiseCode: string,
    from: string,
    to: string,
    dimension: string,
    granularity: TrendGranularity,
    rangeLabel: string,
  ): Promise<TrendData | null> {
    // Overall + gender + category + teacher, one row per day for this school.
    const sql = `
      SELECT TO_CHAR(ATTENDANCE_DATE,'YYYY-MM-DD') AS "d",
             NVL(STU_PRESENT,0) AS "sp", NVL(STU_ABSENT,0) AS "sa",
             NVL(TCH_PRESENT,0) AS "tp", NVL(TCH_MARKED,0) AS "tm",
             NVL(MALE_PRESENT,0) "mp", NVL(MALE_ABSENT,0) "ma",
             NVL(FEMALE_PRESENT,0) "fp", NVL(FEMALE_ABSENT,0) "fa",
             NVL(OTHERS_PRESENT,0) "op", NVL(OTHERS_ABSENT,0) "oa",
             NVL(GENERAL_PRESENT,0) "gp", NVL(GENERAL_ABSENT,0) "ga",
             NVL(SC_PRESENT,0) "scp", NVL(SC_ABSENT,0) "sca",
             NVL(ST_PRESENT,0) "stp", NVL(ST_ABSENT,0) "sta",
             NVL(OBC_PRESENT,0) "obp", NVL(OBC_ABSENT,0) "oba"
      FROM ${this.q.schema}.MV_ATT_SCHOOL_DAY
      WHERE UDISE_CODE = :1
        AND ATTENDANCE_DATE BETWEEN TO_DATE(:2,'YYYY-MM-DD') AND TO_DATE(:3,'YYYY-MM-DD')
      ORDER BY ATTENDANCE_DATE`;
    const rows = await this.q.query(sql, [udiseCode, from, to]);
    if (!rows.length && dimension !== 'class') return null;

    const stu: DailyCountPoint[] = rows.map((r: any) => ({ d: r.d, present: Number(r.sp), absent: Number(r.sa) }));
    const tch: DailyCountPoint[] = rows.map((r: any) => ({
      d: r.d, present: Number(r.tp), absent: Math.max(0, Number(r.tm) - Number(r.tp)),
    }));

    // Card 1 (reported) at school = the school's own present % (teacher/student).
    const overallPts = this.bucketOverall(stu, tch, granularity);
    const reported: ReportedPoint[] = overallPts.map((p) => ({
      period: p.period, teacher: p.teacher, student: p.student,
    }));

    const present: TrendData['present'] = { overall: overallPts };

    if (dimension === 'gender') {
      present.byGender = {
        male: this.bucketValue(rows.map((r: any) => ({ d: r.d, present: Number(r.mp), absent: Number(r.ma) })), granularity),
        female: this.bucketValue(rows.map((r: any) => ({ d: r.d, present: Number(r.fp), absent: Number(r.fa) })), granularity),
        others: this.bucketValue(rows.map((r: any) => ({ d: r.d, present: Number(r.op), absent: Number(r.oa) })), granularity),
      } as any;
    } else if (dimension === 'category') {
      present.byCategory = {
        general: this.bucketValue(rows.map((r: any) => ({ d: r.d, present: Number(r.gp), absent: Number(r.ga) })), granularity),
        sc: this.bucketValue(rows.map((r: any) => ({ d: r.d, present: Number(r.scp), absent: Number(r.sca) })), granularity),
        st: this.bucketValue(rows.map((r: any) => ({ d: r.d, present: Number(r.stp), absent: Number(r.sta) })), granularity),
        obc: this.bucketValue(rows.map((r: any) => ({ d: r.d, present: Number(r.obp), absent: Number(r.oba) })), granularity),
      } as any;
    } else if (dimension === 'class') {
      present.byClass = await this.computeSchoolClassTrend(udiseCode, from, to, granularity);
    }

    return { granularity, range: rangeLabel, reported, present };
  }

  /** Per-class windowed series for a school, from the raw V2 view by GRADE. */
  private async computeSchoolClassTrend(
    udiseCode: string,
    from: string,
    to: string,
    granularity: TrendGranularity,
  ): Promise<Record<string, ValuePoint[]>> {
    const sql = `
      SELECT TO_CHAR(ATTENDANCE_DATE,'YYYY-MM-DD') AS "d",
             GRADE AS "grade",
             NVL(SUM(NVL(MALE_PRESENT,0)+NVL(FEMALE_PRESENT,0)+NVL(TRANSGENDER_PRESENT,0)),0) AS "p",
             NVL(SUM(NVL(MALE_ABSENT,0) +NVL(FEMALE_ABSENT,0) +NVL(TRANSGENDER_ABSENT,0)),0)  AS "a"
      FROM ${this.q.schema}.VW_STUDENT_ATTENDANCE_V2
      WHERE UDISE_CODE = :1
        AND ATTENDANCE_DATE BETWEEN TO_DATE(:2,'YYYY-MM-DD') AND TO_DATE(:3,'YYYY-MM-DD')
      GROUP BY ATTENDANCE_DATE, GRADE
      ORDER BY ATTENDANCE_DATE`;
    const rows = await this.q.query(sql, [udiseCode, from, to]);
    const byGrade = new Map<string, DailyCountPoint[]>();
    for (const r of rows as any[]) {
      const g = String(Number(r.grade));
      const arr = byGrade.get(g) ?? [];
      arr.push({ d: r.d, present: Number(r.p), absent: Number(r.a) });
      byGrade.set(g, arr);
    }
    const out: Record<string, ValuePoint[]> = {};
    for (const [g, daily] of byGrade) out[g] = this.bucketValue(daily, granularity);
    return out;
  }
}

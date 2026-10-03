import { Injectable, Logger } from '@nestjs/common';

import { AttendanceQueryService } from './attendance-query.service';
import {
  AttendancePageData,
  DailyCountPoint,
  StudentReportedDailyPoint,
  TeacherDailyPoint,
  StudentOverallSeriesBlob,
  TeacherSeriesBlob,
  DimensionSeriesBlob,
  GeoData,
  GeoRegion,
  StudentBreakdownData,
  StudentBreakdownBar,
} from './interfaces/dashboard';
import {
  page1Key,
  seriesKey,
  GeoNode,
  GeoLevel,
} from './utils/cache-key.util';

/**
 * Attendance Redis populator (design.md §14 / §17).
 *
 * The ONLY component (besides the dev fallback) that reads Oracle. Invoked by
 * the nightly cron AFTER REFRESH_ATTENDANCE_VIEWS. It reads the PRE-AGGREGATED
 * MV rows and writes ready-to-serve JSON blobs into Redis — the exact shapes the
 * API reads (interfaces/dashboard.ts), so the API never computes at request time.
 *
 * Two concerns:
 *   1) populatePage1(date)  — per-node Page-1 snapshots + per-school keys.
 *   2) populateSeries()     — per-node 6-month daily-series blobs (overall,
 *                             class, gender, category, teacher) for Trends.
 *
 * Rollup strategy: read the geo×day MV once per concern and fold to each level
 * (national/state/district/block/cluster) in Node, so the DB does the heavy
 * grouping and the populator does cheap in-memory sums. Writes carry the 2-day
 * TTL (AttendanceQueryService.ttlSeconds).
 */
@Injectable()
export class AttendancePopulatorService {
  private readonly logger = new Logger(AttendancePopulatorService.name);

  constructor(private readonly q: AttendanceQueryService) {}

  private get schema() {
    return this.q.schema;
  }

  /** Run the full nightly population (Page 1 for `date` + all trend series). */
  async runNightly(date?: string): Promise<{
    date: string; page1Nodes: number; seriesNodes: number; geoNodes: number; breakdownNodes: number;
  }> {
    const d = date ?? (await this.latestDataDate()) ?? this.q.todayISO();
    this.logger.log(`Populator starting for date=${d} (schema=${this.schema}, ttl=${this.q.ttlSeconds}s)`);
    // Publish the default snapshot date so the API resolves it from Redis
    // (requirement B2) under the full TTL instead of a per-request MAX() lookup.
    await this.q.set('att:v1:meta:latestDate', d);
    const page1Nodes = await this.populatePage1(d);
    const seriesNodes = await this.populateSeries(d);
    // Option A: pre-populate geo (map+bar children) + student-breakdown so prod
    // (REDIS_ONLY=true) serves them from Redis without any request-time ADW hit.
    const geoNodes = await this.populateGeo(d);
    const breakdownNodes = await this.populateStudentBreakdown(d);
    this.logger.log(
      `Populator done: page1Nodes=${page1Nodes}, seriesNodes=${seriesNodes}, geoNodes=${geoNodes}, breakdownNodes=${breakdownNodes}`,
    );
    return { date: d, page1Nodes, seriesNodes, geoNodes, breakdownNodes };
  }

  /** The most recent ATTENDANCE_DATE present in the geo×day MV. */
  async latestDataDate(): Promise<string | null> {
    const rows = await this.q.query<{ d: string }>(
      `SELECT TO_CHAR(MAX(ATTENDANCE_DATE),'YYYY-MM-DD') AS "d" FROM ${this.schema}.MV_ATT_GEO_DAY`,
    );
    return rows[0]?.d ?? null;
  }

  // ── Concern 1: Page-1 per-node snapshots ────────────────────────────────────
  async populatePage1(date: string): Promise<number> {
    // Active-school census + RVSK headcount per full geo path (denominator).
    const census = await this.q.query<any>(
      `SELECT STATE_KEY "sk", DISTRICT_KEY "dk", BLOCK_KEY "bk", CLUSTER_KEY "ck",
              ACTIVE_SCHOOLS "act", RVSK_TOTAL_STUDENTS "stu", RVSK_TOTAL_TEACHERS "tch"
       FROM ${this.schema}.MV_GEO_ACTIVE_SCHOOLS`,
    );
    // The day's attendance rollup per full geo path.
    const att = await this.q.query<any>(
      `SELECT STATE_KEY "sk", DISTRICT_KEY "dk", BLOCK_KEY "bk", CLUSTER_KEY "ck",
              STU_PRESENT "sp", STU_ABSENT "saB", TCH_MARKED "tm", TCH_PRESENT "tp",
              TCH_ABSENT "ta", TCH_ON_DUTY "tod",
              SCHOOLS_REPORTING_STUDENT "srs", SCHOOLS_REPORTING_TEACHER "srt"
       FROM ${this.schema}.MV_ATT_GEO_DAY
       WHERE ATTENDANCE_DATE = TO_DATE(:1,'YYYY-MM-DD')`,
      [date],
    );

    // UDISE 25-26 static reference (national row = STATE_KEY NULL; per-state rows).
    const udiseRows = await this.q.query<any>(
      `SELECT STATE_KEY "sk", GRAIN "grain", TOTAL_SCHOOLS "sc", TOTAL_TEACHERS "tch", TOTAL_STUDENTS "stu"
       FROM ${this.schema}.VW_UDISE_STATIC_DATA
       WHERE ACADEMIC_YEAR = '2025-26'`,
    );
    const udiseNational =
      udiseRows.find((r: any) => r.sk == null) ?? null;
    const udiseByState = new Map<string, any>();
    for (const r of udiseRows) if (r.sk != null) udiseByState.set(String(r.sk), r);

    // Fold both to each geo level. `Cov` tracks the distinct child geos seen in
    // the census (expected) and in the day's attendance (reported) so coverage
    // is computed WITHIN each node's scope.
    type Cov = {
      expStates: Set<string>; expDistricts: Set<string>; expBlocks: Set<string>;
      repStates: Set<string>; repDistricts: Set<string>; repBlocks: Set<string>;
    };
    type Agg = {
      act: number; rvskStu: number; rvskTch: number;
      sp: number; sa: number; tm: number; tp: number; ta: number; tod: number;
      srs: number; srt: number;
      cov: Cov;
    };
    const zeroCov = (): Cov => ({
      expStates: new Set(), expDistricts: new Set(), expBlocks: new Set(),
      repStates: new Set(), repDistricts: new Set(), repBlocks: new Set(),
    });
    const zero = (): Agg => ({
      act: 0, rvskStu: 0, rvskTch: 0, sp: 0, sa: 0, tm: 0, tp: 0, ta: 0, tod: 0, srs: 0, srt: 0,
      cov: zeroCov(),
    });
    const levels: Record<GeoLevel, Map<string, Agg>> = {
      national: new Map(), state: new Map(), district: new Map(), block: new Map(), cluster: new Map(),
    };
    // Map each sub-state node (level:key) → its containing STATE_KEY, so UDISE
    // 25-26 can stick to the parent state below State level (requirement C3).
    const nodeState = new Map<string, string>();
    const NAT = '_';
    const ensure = (m: Map<string, Agg>, k: string): Agg => {
      let e = m.get(k);
      if (!e) { e = zero(); m.set(k, e); }
      return e;
    };
    const addCounts = (e: Agg, patch: Partial<Agg>) => {
      for (const [f, v] of Object.entries(patch)) {
        if (f === 'cov') continue;
        (e as any)[f] += Number(v ?? 0);
      }
    };
    // Record distinct child geos into a node's coverage sets (`expected` side).
    const covExpected = (e: Agg, r: any) => {
      if (r.sk != null) e.cov.expStates.add(String(r.sk));
      if (r.dk != null) e.cov.expDistricts.add(String(r.dk));
      if (r.bk != null) e.cov.expBlocks.add(String(r.bk));
    };
    const covReported = (e: Agg, r: any) => {
      if (r.sk != null) e.cov.repStates.add(String(r.sk));
      if (r.dk != null) e.cov.repDistricts.add(String(r.dk));
      if (r.bk != null) e.cov.repBlocks.add(String(r.bk));
    };

    const recordState = (lvl: GeoLevel, key: string, r: any) => {
      if (lvl !== 'national' && lvl !== 'state' && r.sk != null) {
        nodeState.set(`${lvl}:${key}`, String(r.sk));
      }
    };

    for (const r of census) {
      const patch = { act: +r.act, rvskStu: +r.stu, rvskTch: +r.tch };
      for (const [lvl, key] of this.nodeKeysFor(r, NAT)) {
        const e = ensure(levels[lvl], key);
        addCounts(e, patch);
        covExpected(e, r);
        recordState(lvl, key, r);
      }
    }
    for (const r of att) {
      const patch = {
        sp: +r.sp, sa: +r.saB, tm: +r.tm, tp: +r.tp, ta: +r.ta, tod: +r.tod, srs: +r.srs, srt: +r.srt,
      };
      for (const [lvl, key] of this.nodeKeysFor(r, NAT)) {
        const e = ensure(levels[lvl], key);
        addCounts(e, patch);
        covReported(e, r);
        recordState(lvl, key, r);
      }
    }

    const writes: { key: string; value: any }[] = [];
    for (const level of Object.keys(levels) as GeoLevel[]) {
      for (const [k, a] of levels[level]) {
        const node: GeoNode = level === 'national' ? { level } : { level, key: k };
        // UDISE 25-26 (requirement C3): national → All-India row; state → own
        // row; district/block/cluster → the CONTAINING STATE's row (sticks).
        let udiseRef: any = null;
        if (level === 'national') udiseRef = udiseNational;
        else if (level === 'state') udiseRef = udiseByState.get(k) ?? null;
        else {
          const parentState = nodeState.get(`${level}:${k}`);
          udiseRef = parentState ? udiseByState.get(parentState) ?? null : null;
        }
        const blob = this.buildPage1Blob(date, level, a, udiseRef);
        writes.push({ key: page1Key(date, node), value: blob });
      }
    }
    await this.q.setMany(writes); // one pipeline instead of N awaited SETs
    const count = writes.length;

    // NOTE: school-level Page-1 is NOT pre-populated. Schools are served
    // on-demand from MV_ATT_SCHOOL_DAY with cache-through (requirement C7,
    // option b) — avoids ~1.15M nightly keys; only viewed schools get cached.

    return count;
  }

  /** Yield the (level,key) node buckets a geo-path row contributes to. */
  private *nodeKeysFor(r: any, nat: string): Iterable<[GeoLevel, string]> {
    yield ['national', nat];
    if (r.sk != null) yield ['state', String(r.sk)];
    if (r.dk != null) yield ['district', String(r.dk)];
    if (r.bk != null) yield ['block', String(r.bk)];
    if (r.ck != null) yield ['cluster', String(r.ck)];
  }

  private buildPage1Blob(
    date: string,
    level: GeoLevel,
    a: {
      act: number; rvskStu: number; rvskTch: number;
      sp: number; sa: number; tm: number; tp: number; ta: number; tod: number;
      srs: number; srt: number;
      cov: {
        expStates: Set<string>; expDistricts: Set<string>; expBlocks: Set<string>;
        repStates: Set<string>; repDistricts: Set<string>; repBlocks: Set<string>;
      };
    },
    udiseRef: { grain?: string; sc?: number; tch?: number; stu?: number } | null,
  ): AttendancePageData {
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n * 10000) / d) / 100 : 0);
    const stuMarked = a.sp + a.sa;
    const scopeLevel = level === 'national' ? 'national' : level === 'state' ? 'state' : 'district';

    // Coverage: reported (distinct child geos with any attendance today) vs
    // expected (distinct active child geos), scoped to this node. For a state
    // node the "states" pair is itself (1/1); districts/blocks are its children.
    const coverage = {
      states: { reported: a.cov.repStates.size, expected: a.cov.expStates.size },
      districts: { reported: a.cov.repDistricts.size, expected: a.cov.expDistricts.size },
      blocks: { reported: a.cov.repBlocks.size, expected: a.cov.expBlocks.size },
    };

    return {
      asOfDate: date,
      scopeLevel,
      integrationCoverage: coverage,
      integrationStatus: {
        udiseRef: udiseRef
          ? {
              grain: (udiseRef.grain as 'NATIONAL' | 'STATE') ?? null,
              schools: Number(udiseRef.sc ?? 0),
              teachers: Number(udiseRef.tch ?? 0),
              students: Number(udiseRef.stu ?? 0),
            }
          : null,
        rvskMaster: { schools: a.act, teachers: a.rvskTch, students: a.rvskStu },
        onboarded: { schools: a.act, teachers: a.rvskTch, students: a.rvskStu },
        yetToOnboard: { schools: 0, teachers: 0, students: 0 },
      },
      schoolIntegration: {
        onboarded: a.act,
        reportingTeacher: a.srt,
        reportingStudent: a.srs,
      },
      teacher: {
        totalInSchools: a.rvskTch,
        totalReported: a.tm,
        reportedPct: pct(a.tm, a.rvskTch),
        present: a.tp,
        absent: a.ta,
        onDuty: a.tod,
        presentPct: pct(a.tp, a.tm),
        absentPct: pct(a.ta, a.tm),
        onDutyPct: pct(a.tod, a.tm),
      },
      student: {
        totalInSchools: a.rvskStu,
        totalReported: stuMarked,
        reportedPct: pct(a.srs, a.act),
        present: a.sp,
        absent: a.sa,
        presentPct: pct(a.sp, stuMarked),
        absentPct: pct(a.sa, stuMarked),
      },
    };
  }

  // ── Concern 2: Trend series blobs (6-month daily) ────────────────────────────
  async populateSeries(endDate: string): Promise<number> {
    const from = this.monthsBefore(endDate, this.q.seriesMonths);

    // Active-school census per full path (denominator for reporting %) — a
    // point-in-time snapshot applied to every day in the window.
    const census = await this.q.query<any>(
      `SELECT STATE_KEY "sk", DISTRICT_KEY "dk", BLOCK_KEY "bk", CLUSTER_KEY "ck", ACTIVE_SCHOOLS "act"
       FROM ${this.schema}.MV_GEO_ACTIVE_SCHOOLS`,
    );
    const activeByLevel = this.foldActive(census);

    // Overall + teacher daily per full path.
    const rows = await this.q.query<any>(
      `SELECT TO_CHAR(ATTENDANCE_DATE,'YYYY-MM-DD') "d",
              STATE_KEY "sk", DISTRICT_KEY "dk", BLOCK_KEY "bk", CLUSTER_KEY "ck",
              STU_PRESENT "sp", STU_ABSENT "saB",
              TCH_MARKED "tm", TCH_PRESENT "tp", TCH_ABSENT "ta", TCH_ON_DUTY "tod",
              SCHOOLS_REPORTING_STUDENT "srs", SCHOOLS_REPORTING_TEACHER "srt"
       FROM ${this.schema}.MV_ATT_GEO_DAY
       WHERE ATTENDANCE_DATE BETWEEN TO_DATE(:1,'YYYY-MM-DD') AND TO_DATE(:2,'YYYY-MM-DD')`,
      [from, endDate],
    );

    // node -> date -> aggregates
    const overall = new Map<string, Map<string, { sp: number; sa: number; tp: number; tm: number; ta: number; tod: number; srs: number; srt: number }>>();
    const addOverall = (nodeId: string, d: string, r: any) => {
      let byDate = overall.get(nodeId);
      if (!byDate) { byDate = new Map(); overall.set(nodeId, byDate); }
      const e = byDate.get(d) ?? { sp: 0, sa: 0, tp: 0, tm: 0, ta: 0, tod: 0, srs: 0, srt: 0 };
      e.sp += +r.sp; e.sa += +r.saB; e.tp += +r.tp; e.tm += +r.tm; e.ta += +r.ta; e.tod += +r.tod; e.srs += +r.srs; e.srt += +r.srt;
      byDate.set(d, e);
    };
    for (const r of rows) {
      addOverall(this.nodeId('national'), r.d, r);
      if (r.sk != null) addOverall(this.nodeId('state', r.sk), r.d, r);
      if (r.dk != null) addOverall(this.nodeId('district', r.dk), r.d, r);
      if (r.bk != null) addOverall(this.nodeId('block', r.bk), r.d, r);
      if (r.ck != null) addOverall(this.nodeId('cluster', r.ck), r.d, r);
    }

    const seriesWrites: { key: string; value: any }[] = [];
    for (const [nodeId, byDate] of overall) {
      const node = this.parseNodeId(nodeId);
      const active = this.activeFor(activeByLevel, node);
      const dates = [...byDate.keys()].sort();

      const present: DailyCountPoint[] = dates.map((d) => {
        const e = byDate.get(d)!;
        return { d, present: e.sp, absent: e.sa };
      });
      const reported: StudentReportedDailyPoint[] = dates.map((d) => {
        const e = byDate.get(d)!;
        return { d, reportingSchools: e.srs, activeSchools: active };
      });
      const teacherDaily: TeacherDailyPoint[] = dates.map((d) => {
        const e = byDate.get(d)!;
        return { d, marked: e.tm, present: e.tp, reportingSchools: e.srt, activeSchools: active };
      });

      const overallBlob: StudentOverallSeriesBlob = { present, reported };
      const teacherBlob: TeacherSeriesBlob = { daily: teacherDaily };
      seriesWrites.push({ key: seriesKey(node, 'student:overall'), value: overallBlob });
      seriesWrites.push({ key: seriesKey(node, 'teacher'), value: teacherBlob });
    }
    await this.q.setMany(seriesWrites);
    let count = seriesWrites.length;

    // Dimensioned series: gender + category (from MV_ATT_GEO_DAY columns),
    // class (from MV_ATT_GEO_DAY_GRADE). Written per node.
    count += await this.populateGenderCategory(from, endDate);
    count += await this.populateClass(from, endDate);
    return count;
  }

  private async populateGenderCategory(from: string, to: string): Promise<number> {
    const rows = await this.q.query<any>(
      `SELECT TO_CHAR(ATTENDANCE_DATE,'YYYY-MM-DD') "d",
              STATE_KEY "sk", DISTRICT_KEY "dk", BLOCK_KEY "bk", CLUSTER_KEY "ck",
              MALE_PRESENT "mp", MALE_ABSENT "ma", FEMALE_PRESENT "fp", FEMALE_ABSENT "fa",
              OTHERS_PRESENT "op", OTHERS_ABSENT "oa",
              GENERAL_PRESENT "gp", GENERAL_ABSENT "ga", SC_PRESENT "scp", SC_ABSENT "sca",
              ST_PRESENT "stp", ST_ABSENT "sta", OBC_PRESENT "obp", OBC_ABSENT "oba"
       FROM ${this.schema}.MV_ATT_GEO_DAY
       WHERE ATTENDANCE_DATE BETWEEN TO_DATE(:1,'YYYY-MM-DD') AND TO_DATE(:2,'YYYY-MM-DD')`,
      [from, to],
    );

    // node -> stream -> seriesKey -> date -> {p,a}
    const genderAcc = new Map<string, Map<string, Map<string, { p: number; a: number }>>>();
    const categoryAcc = new Map<string, Map<string, Map<string, { p: number; a: number }>>>();
    const add = (acc: typeof genderAcc, nodeId: string, sub: string, d: string, p: number, ab: number) => {
      let byS = acc.get(nodeId); if (!byS) { byS = new Map(); acc.set(nodeId, byS); }
      let byD = byS.get(sub); if (!byD) { byD = new Map(); byS.set(sub, byD); }
      const e = byD.get(d) ?? { p: 0, a: 0 }; e.p += p; e.a += ab; byD.set(d, e);
    };
    const feed = (nodeId: string, r: any) => {
      add(genderAcc, nodeId, 'male', r.d, +r.mp, +r.ma);
      add(genderAcc, nodeId, 'female', r.d, +r.fp, +r.fa);
      add(genderAcc, nodeId, 'others', r.d, +r.op, +r.oa);
      add(categoryAcc, nodeId, 'general', r.d, +r.gp, +r.ga);
      add(categoryAcc, nodeId, 'sc', r.d, +r.scp, +r.sca);
      add(categoryAcc, nodeId, 'st', r.d, +r.stp, +r.sta);
      add(categoryAcc, nodeId, 'obc', r.d, +r.obp, +r.oba);
    };
    for (const r of rows) {
      feed(this.nodeId('national'), r);
      if (r.sk != null) feed(this.nodeId('state', r.sk), r);
      if (r.dk != null) feed(this.nodeId('district', r.dk), r);
      if (r.bk != null) feed(this.nodeId('block', r.bk), r);
      if (r.ck != null) feed(this.nodeId('cluster', r.ck), r);
    }

    let count = 0;
    count += await this.writeDimension(genderAcc, 'student:gender');
    count += await this.writeDimension(categoryAcc, 'student:category');
    return count;
  }

  private async populateClass(from: string, to: string): Promise<number> {
    const rows = await this.q.query<any>(
      `SELECT TO_CHAR(ATTENDANCE_DATE,'YYYY-MM-DD') "d",
              STATE_KEY "sk", DISTRICT_KEY "dk", BLOCK_KEY "bk", CLUSTER_KEY "ck",
              GRADE "g", STU_PRESENT "sp", STU_ABSENT "saB"
       FROM ${this.schema}.MV_ATT_GEO_DAY_GRADE
       WHERE ATTENDANCE_DATE BETWEEN TO_DATE(:1,'YYYY-MM-DD') AND TO_DATE(:2,'YYYY-MM-DD')`,
      [from, to],
    );
    const acc = new Map<string, Map<string, Map<string, { p: number; a: number }>>>();
    const add = (nodeId: string, grade: string, d: string, p: number, ab: number) => {
      let byS = acc.get(nodeId); if (!byS) { byS = new Map(); acc.set(nodeId, byS); }
      let byD = byS.get(grade); if (!byD) { byD = new Map(); byS.set(grade, byD); }
      const e = byD.get(d) ?? { p: 0, a: 0 }; e.p += p; e.a += ab; byD.set(d, e);
    };
    for (const r of rows) {
      const grade = String(r.g);
      add(this.nodeId('national'), grade, r.d, +r.sp, +r.saB);
      if (r.sk != null) add(this.nodeId('state', r.sk), grade, r.d, +r.sp, +r.saB);
      if (r.dk != null) add(this.nodeId('district', r.dk), grade, r.d, +r.sp, +r.saB);
      if (r.bk != null) add(this.nodeId('block', r.bk), grade, r.d, +r.sp, +r.saB);
      if (r.ck != null) add(this.nodeId('cluster', r.ck), grade, r.d, +r.sp, +r.saB);
    }
    return this.writeDimension(acc, 'student:class');
  }

  private async writeDimension(
    acc: Map<string, Map<string, Map<string, { p: number; a: number }>>>,
    stream: string,
  ): Promise<number> {
    const writes: { key: string; value: any }[] = [];
    for (const [nodeId, byS] of acc) {
      const node = this.parseNodeId(nodeId);
      const series: Record<string, DailyCountPoint[]> = {};
      for (const [sub, byD] of byS) {
        series[sub] = [...byD.keys()].sort().map((d) => {
          const e = byD.get(d)!;
          return { d, present: e.p, absent: e.a };
        });
      }
      const blob: DimensionSeriesBlob = { series };
      writes.push({ key: seriesKey(node, stream), value: blob });
    }
    await this.q.setMany(writes);
    return writes.length;
  }

  // ── Concern 3: Geo children per node (map + State/UT bar) — Option A ─────────
  // Writes att:v1:geo:{nodeSeg}:{date} for every parent node (national→cluster),
  // each holding its CHILD regions {studentAttendancePct, teacherReportedPct,
  // lat, lng}. Mirrors AttendanceGeoService.computeChildren, computed for ALL
  // parents in one pass instead of per request.
  async populateGeo(date: string): Promise<number> {
    // One grouped query per parent→child relationship. The heavy work (census
    // teacher-denominator + centroid over ~1.15M schools) is done in Oracle via
    // GROUP BY, returning only ~child-count rows — NOT 1.15M rows into Node.
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n * 10000) / d) / 100 : 0);
    const writes: { key: string; value: any }[] = [];

    // levels: [parentCol | null, childKeyCol, childNameCol, childLevel, parentIdFn]
    const rels: Array<{
      parentCol: string | null;
      childKey: string;
      childName: string;
      level: GeoRegion['level'];
    }> = [
      { parentCol: null, childKey: 'STATE_KEY', childName: 'STATE_NAME', level: 'state' },
      { parentCol: 'STATE_KEY', childKey: 'DISTRICT_KEY', childName: 'DISTRICT_NAME', level: 'district' },
      { parentCol: 'DISTRICT_KEY', childKey: 'BLOCK_KEY', childName: 'BLOCK_NAME', level: 'block' },
      { parentCol: 'BLOCK_KEY', childKey: 'CLUSTER_KEY', childName: 'CLUSTER_NAME', level: 'cluster' },
    ];

    for (const rel of rels) {
      // Census (per parent,child): name, teacher denom, centroid.
      const parentSel = rel.parentCol ? `TO_CHAR(${rel.parentCol}) "pk",` : '';
      const parentGrp = rel.parentCol ? `${rel.parentCol},` : '';
      const censusSql = `
        SELECT ${parentSel} TO_CHAR(${rel.childKey}) "ck", MAX(${rel.childName}) "cn",
               NVL(SUM(TOTAL_TEACHERS),0) "tt", AVG(LATITUDE) "lat", AVG(LONGITUDE) "lng"
        FROM ${this.schema}.MV_GEO_SCHOOL_DIM
        WHERE ${rel.childKey} IS NOT NULL
        GROUP BY ${parentGrp} ${rel.childKey}`;
      // Attendance (per parent,child) for the date.
      const attSql = `
        SELECT ${parentSel} TO_CHAR(${rel.childKey}) "ck",
               NVL(SUM(STU_PRESENT),0) "sp", NVL(SUM(STU_ABSENT),0) "sa", NVL(SUM(TCH_MARKED),0) "tm"
        FROM ${this.schema}.MV_ATT_GEO_DAY
        WHERE ATTENDANCE_DATE = TO_DATE(:1,'YYYY-MM-DD') AND ${rel.childKey} IS NOT NULL
        GROUP BY ${parentGrp} ${rel.childKey}`;

      const [census, att] = await Promise.all([
        this.q.query<any>(censusSql),
        this.q.query<any>(attSql, [date]),
      ]);

      // Index attendance by parent|child.
      const attMap = new Map<string, any>();
      for (const r of att) attMap.set(`${r.pk ?? '_'}|${r.ck}`, r);

      // Group children under each parent node id.
      const byParent = new Map<string, GeoRegion[]>();
      for (const c of census) {
        const parentId = rel.parentCol ? `${rel.level === 'district' ? 'state' : rel.level === 'block' ? 'district' : 'block'}:${c.pk}` : 'national';
        const a = attMap.get(`${c.pk ?? '_'}|${c.ck}`);
        const sp = Number(a?.sp ?? 0), sa = Number(a?.sa ?? 0), tm = Number(a?.tm ?? 0);
        const region: GeoRegion = {
          level: rel.level,
          key: String(c.ck),
          name: c.cn ?? '',
          studentAttendancePct: pct(sp, sp + sa),
          teacherReportedPct: pct(tm, Number(c.tt ?? 0)),
          lat: c.lat != null ? Number(c.lat) : null,
          lng: c.lng != null ? Number(c.lng) : null,
        };
        const arr = byParent.get(parentId) ?? [];
        arr.push(region);
        byParent.set(parentId, arr);
      }

      for (const [parentId, regions] of byParent) {
        regions.sort((a, b) => b.teacherReportedPct - a.teacherReportedPct);
        const data: GeoData = { childLevel: rel.level, regions };
        writes.push({ key: `att:v1:geo:${parentId}:${date}`, value: data });
      }
    }

    await this.q.setMany(writes);
    return writes.length;
  }

  // ── Concern 4: Student breakdown per node (class/gender/category) — Option A ──
  // Writes att:v1:studentbreak:{nodeSeg}:{date} for every node. Mirrors
  // AttendanceStudentService.computeGeo for all nodes in one pass.
  async populateStudentBreakdown(date: string): Promise<number> {
    const GENDER: [string, string, string][] = [
      ['Male', 'mp', 'ma'], ['Female', 'fp', 'fa'], ['Others', 'op', 'oa'],
    ];
    const CATEGORY: [string, string, string][] = [
      ['General', 'gp', 'ga'], ['SC', 'scp', 'sca'], ['ST', 'stp', 'sta'], ['OBC', 'obp', 'oba'],
    ];

    // Gender/category per geo-path (one date).
    const gc = await this.q.query<any>(
      `SELECT STATE_KEY "sk", DISTRICT_KEY "dk", BLOCK_KEY "bk", CLUSTER_KEY "ck",
              MALE_PRESENT "mp", MALE_ABSENT "ma", FEMALE_PRESENT "fp", FEMALE_ABSENT "fa",
              OTHERS_PRESENT "op", OTHERS_ABSENT "oa",
              GENERAL_PRESENT "gp", GENERAL_ABSENT "ga", SC_PRESENT "scp", SC_ABSENT "sca",
              ST_PRESENT "stp", ST_ABSENT "sta", OBC_PRESENT "obp", OBC_ABSENT "oba"
       FROM ${this.schema}.MV_ATT_GEO_DAY
       WHERE ATTENDANCE_DATE = TO_DATE(:1,'YYYY-MM-DD')`,
      [date],
    );
    // Class per geo-path×grade (one date).
    const cls = await this.q.query<any>(
      `SELECT STATE_KEY "sk", DISTRICT_KEY "dk", BLOCK_KEY "bk", CLUSTER_KEY "ck",
              GRADE "g", STU_PRESENT "sp", STU_ABSENT "saB"
       FROM ${this.schema}.MV_ATT_GEO_DAY_GRADE
       WHERE ATTENDANCE_DATE = TO_DATE(:1,'YYYY-MM-DD')`,
      [date],
    );

    // nodeId -> { gc: {col->{p,a}}, cls: {grade->{p,a}} }
    const acc = new Map<string, { gc: Record<string, { p: number; a: number }>; cls: Map<number, { p: number; a: number }> }>();
    const ensure = (id: string) => {
      let e = acc.get(id);
      if (!e) { e = { gc: {}, cls: new Map() }; acc.set(id, e); }
      return e;
    };
    const bump = (id: string, col: string, p: number, a: number) => {
      const e = ensure(id); const x = e.gc[col] ?? { p: 0, a: 0 }; x.p += p; x.a += a; e.gc[col] = x;
    };
    const gcNodes = (r: any): string[] => {
      const out = ['national'];
      if (r.sk != null) out.push(`state:${r.sk}`);
      if (r.dk != null) out.push(`district:${r.dk}`);
      if (r.bk != null) out.push(`block:${r.bk}`);
      if (r.ck != null) out.push(`cluster:${r.ck}`);
      return out;
    };
    for (const r of gc) {
      for (const id of gcNodes(r)) {
        for (const [, p, a] of [...GENDER, ...CATEGORY]) bump(id, p, +r[p] || 0, +r[a] || 0);
      }
    }
    for (const r of cls) {
      const g = Number(r.g);
      if (!Number.isFinite(g)) continue;
      for (const id of gcNodes(r)) {
        const e = ensure(id); const x = e.cls.get(g) ?? { p: 0, a: 0 }; x.p += +r.sp || 0; x.a += +r.saB || 0; e.cls.set(g, x);
      }
    }

    const pct = (n: number, d: number) => (d > 0 ? Math.round((n * 10000) / d) / 100 : 0);
    const bars = (e: { gc: Record<string, { p: number; a: number }> }, defs: [string, string, string][]): StudentBreakdownBar[] =>
      defs.map(([label, p]) => {
        const v = e.gc[p] ?? { p: 0, a: 0 };
        return { label, present: v.p, absent: v.a, pct: pct(v.p, v.p + v.a) };
      });

    const writes: { key: string; value: any }[] = [];
    for (const [id, e] of acc) {
      const byClass: StudentBreakdownBar[] = [...e.cls.entries()]
        .sort(([x], [y]) => x - y)
        .map(([g, v]) => ({ label: `Class ${g}`, present: v.p, absent: v.a, pct: pct(v.p, v.p + v.a) }));
      const data: StudentBreakdownData = {
        byClass,
        byGender: bars(e, GENDER),
        byCategory: bars(e, CATEGORY),
      };
      writes.push({ key: `att:v1:studentbreak:${id}:${date}`, value: data });
    }
    await this.q.setMany(writes);
    return writes.length;
  }

  // ── node id helpers (compact string ↔ GeoNode) ───────────────────────────────
  private nodeId(level: GeoLevel, key?: string | number): string {
    return level === 'national' ? 'national' : `${level}:${key}`;
  }
  private parseNodeId(id: string): GeoNode {
    if (id === 'national') return { level: 'national' };
    const [level, key] = id.split(':');
    return { level: level as GeoLevel, key };
  }

  private foldActive(census: any[]): Record<GeoLevel, Map<string, number>> {
    const out: Record<GeoLevel, Map<string, number>> = {
      national: new Map(), state: new Map(), district: new Map(), block: new Map(), cluster: new Map(),
    };
    const bump = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
    for (const r of census) {
      const v = +r.act;
      bump(out.national, '_', v);
      if (r.sk != null) bump(out.state, String(r.sk), v);
      if (r.dk != null) bump(out.district, String(r.dk), v);
      if (r.bk != null) bump(out.block, String(r.bk), v);
      if (r.ck != null) bump(out.cluster, String(r.ck), v);
    }
    return out;
  }
  private activeFor(active: Record<GeoLevel, Map<string, number>>, node: GeoNode): number {
    if (node.level === 'national') return active.national.get('_') ?? 0;
    return active[node.level].get(String(node.key)) ?? 0;
  }

  private monthsBefore(iso: string, months: number): string {
    const d = new Date(iso);
    d.setMonth(d.getMonth() - months);
    return d.toISOString().slice(0, 10);
  }
}

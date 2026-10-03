import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedUser } from '@rvsk/common';

import { AttendanceQueryService } from './attendance-query.service';
import { AttendanceFiltersDto } from './dto/attendance-filters.dto';
import { GeoData, GeoRegion } from './interfaces/dashboard';
import { ok, SuccessEnvelope } from './interfaces/responses';
import { applyScope, resolveScope, resolveNode, ResolvedNode } from './utils/scope.util';

type ChildLevel = 'state' | 'district' | 'block' | 'cluster' | 'school';

/**
 * Page-1 Geography service — powers BOTH the "Attendance by Geography" map
 * (student attendance %, 4-band dot colour) and the "State/UT-wise Attendance
 * (Teachers)" bar (teacher reported %). Drill-aware: returns the CHILDREN of the
 * currently-selected node (national→states, state→districts, …, cluster→schools).
 *
 * Served from a pre-computed Redis blob per node (att:v1:geo:{node}) written by
 * the populator; REDIS_ONLY miss → meta.empty; dev (REDIS_ONLY=false) → live MV
 * compute + cache-through. Child = school tier (cluster→schools) always computes
 * live from the master + MV_ATT_SCHOOL_DAY (option b, never pre-populated).
 */
@Injectable()
export class AttendanceGeoService {
  private readonly logger = new Logger(AttendanceGeoService.name);

  constructor(private readonly q: AttendanceQueryService) {}

  async getGeo(
    filters: AttendanceFiltersDto,
    user: AuthenticatedUser,
  ): Promise<SuccessEnvelope<GeoData | null>> {
    const scope = resolveScope(user);
    const merged = applyScope(scope, filters);
    const date = filters.date ?? (await this.q.latestDataDate());
    const node = resolveNode(merged);
    const childLevel = this.childLevelOf(node.level);

    if (!childLevel) {
      // Already at school level — no further children.
      return ok({ childLevel: 'school', regions: [] }, { asOfDate: date, scopeLevel: scope.level });
    }

    // Redis blob key for this node's geo children.
    const key = `att:v1:geo:${this.nodeSeg(node)}:${date}`;

    // School children (cluster→schools) are always computed live (option b).
    // For geo children: bypass mode skips the read (perf test); else read-through.
    if (childLevel !== 'school' && !this.q.bypassRedis) {
      const cached = await this.q.get<GeoData>(key);
      if (cached) return ok(cached, { asOfDate: date, scopeLevel: scope.level, cached: true });
      if (this.q.redisOnly) {
        return ok(null, { asOfDate: date, scopeLevel: scope.level, cached: false, empty: true });
      }
    }

    const regions = await this.computeChildren(date, node, childLevel);
    const data: GeoData = { childLevel, regions };
    // Cache-through for geo children (skipped in bypass so the test stays pure).
    if (childLevel !== 'school' && !this.q.bypassRedis) await this.q.set(key, data);
    return ok(data, { asOfDate: date, scopeLevel: scope.level, cached: false });
  }

  // ── child level mapping ───────────────────────────────────────────────────────
  private childLevelOf(level: ResolvedNode['level']): ChildLevel | null {
    switch (level) {
      case 'national': return 'state';
      case 'state': return 'district';
      case 'district': return 'block';
      case 'block': return 'cluster';
      case 'cluster': return 'school';
      default: return null;
    }
  }

  private nodeSeg(node: ResolvedNode): string {
    return node.level === 'national' ? 'national' : `${node.level}:${node.key}`;
  }

  // ── live compute of a node's children ──────────────────────────────────────────
  private async computeChildren(
    date: string,
    node: ResolvedNode,
    childLevel: ChildLevel,
  ): Promise<GeoRegion[]> {
    if (childLevel === 'school') {
      return this.computeSchoolChildren(date, node);
    }

    const childKeyCol = {
      state: 'STATE_KEY',
      district: 'DISTRICT_KEY',
      block: 'BLOCK_KEY',
      cluster: 'CLUSTER_KEY',
    }[childLevel];
    const childNameCol = {
      state: 'STATE_NAME',
      district: 'DISTRICT_NAME',
      block: 'BLOCK_NAME',
      cluster: 'CLUSTER_NAME',
    }[childLevel];

    // Parent filter (the selected node) applied to both the attendance rollup
    // and the master census, with the key bound at :N.
    const parent = this.parentFilter(node);

    // Attendance per child for the date. MV_ATT_GEO_DAY is already rolled up to
    // the geo keys (no UDISE), so group by the child key column directly.
    const attSql = `
      SELECT TO_CHAR(g.${childKeyCol}) AS "key",
             NVL(SUM(g.STU_PRESENT),0)  AS "sp",
             NVL(SUM(g.STU_ABSENT),0)   AS "sa",
             NVL(SUM(g.TCH_MARKED),0)   AS "tm"
      FROM ${this.q.schema}.MV_ATT_GEO_DAY g
      WHERE g.ATTENDANCE_DATE = TO_DATE(:1,'YYYY-MM-DD') ${parent.frag('g', 2)}
      GROUP BY g.${childKeyCol}`;

    // Master census per child: teacher denominator (teachers in region) +
    // centroid (avg school lat/lng). Active schools only (dim is IS_ACTIVE=1).
    const censusSql = `
      SELECT TO_CHAR(${childKeyCol}) AS "key",
             MAX(${childNameCol})    AS "name",
             NVL(SUM(TOTAL_TEACHERS),0) AS "tchTotal",
             AVG(LATITUDE)  AS "lat",
             AVG(LONGITUDE) AS "lng"
      FROM ${this.q.schema}.MV_GEO_SCHOOL_DIM
      WHERE 1=1 ${parent.frag('', 1)}
      GROUP BY ${childKeyCol}`;

    const [attRows, censusRows] = await Promise.all([
      this.q.query(attSql, [date, ...parent.binds]),
      this.q.query(censusSql, parent.binds),
    ]);

    const att = new Map<string, any>();
    for (const r of attRows) if (r.key != null) att.set(String(r.key), r);

    const pct = (n: number, d: number) => (d > 0 ? Math.round((n * 10000) / d) / 100 : 0);
    const out: GeoRegion[] = [];
    for (const c of censusRows) {
      if (c.key == null) continue;
      const a = att.get(String(c.key));
      const sp = Number(a?.sp ?? 0);
      const sa = Number(a?.sa ?? 0);
      const tm = Number(a?.tm ?? 0);
      const tchTotal = Number(c.tchTotal ?? 0);
      out.push({
        level: childLevel,
        key: String(c.key),
        name: c.name ?? a?.name ?? '',
        studentAttendancePct: pct(sp, sp + sa),
        teacherReportedPct: pct(tm, tchTotal),
        lat: c.lat != null ? Number(c.lat) : null,
        lng: c.lng != null ? Number(c.lng) : null,
      });
    }
    // Sort by teacher reported % desc (matches the bar's default ordering).
    out.sort((x, y) => y.teacherReportedPct - x.teacherReportedPct);
    return out;
  }

  /** Cluster → individual schools (lat/lng points). Always live (option b). */
  private async computeSchoolChildren(date: string, node: ResolvedNode): Promise<GeoRegion[]> {
    const parent = this.parentFilter(node);
    const sql = `
      SELECT gd.UDISE_CODE AS "key",
             gd.SCHOOL_NAME AS "name",
             gd.LATITUDE  AS "lat",
             gd.LONGITUDE AS "lng",
             NVL(gd.TOTAL_TEACHERS,0) AS "tchTotal",
             NVL(f.STU_PRESENT,0) AS "sp",
             NVL(f.STU_ABSENT,0)  AS "sa",
             NVL(f.TCH_MARKED,0)  AS "tm"
      FROM ${this.q.schema}.MV_GEO_SCHOOL_DIM gd
      LEFT JOIN ${this.q.schema}.MV_ATT_SCHOOL_DAY f
        ON f.UDISE_CODE = gd.UDISE_CODE AND f.ATTENDANCE_DATE = TO_DATE(:1,'YYYY-MM-DD')
      WHERE 1=1 ${parent.frag('gd', 2)}`;
    const rows = await this.q.query(sql, [date, ...parent.binds]);
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n * 10000) / d) / 100 : 0);
    return rows.map((r: any) => {
      const sp = Number(r.sp), sa = Number(r.sa), tm = Number(r.tm), tt = Number(r.tchTotal);
      return {
        level: 'school' as const,
        key: String(r.key),
        name: r.name ?? '',
        studentAttendancePct: pct(sp, sp + sa),
        teacherReportedPct: pct(tm, tt),
        lat: r.lat != null ? Number(r.lat) : null,
        lng: r.lng != null ? Number(r.lng) : null,
      };
    });
  }

  /**
   * WHERE fragment + binds restricting to the selected parent node, for a given
   * alias and starting bind index. National → no filter.
   */
  private parentFilter(node: ResolvedNode): {
    frag: (alias: string, bindStart: number) => string;
    binds: any[];
  } {
    const col: Record<string, string> = {
      state: 'STATE_KEY', district: 'DISTRICT_KEY', block: 'BLOCK_KEY', cluster: 'CLUSTER_KEY',
    };
    if (node.level === 'national') {
      return { frag: () => '', binds: [] };
    }
    const c = col[node.level];
    return {
      frag: (alias: string, bindStart: number) =>
        `AND ${alias ? alias + '.' : ''}${c} = :${bindStart}`,
      binds: [node.key],
    };
  }
}

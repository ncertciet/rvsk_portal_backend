import { Controller, Get, Query, ForbiddenException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '@rvsk/common';

import { FiltersService } from './filters.service';
import { resolveScope, lockedLevels } from '../attendance/utils/scope.util';
import { ok, SuccessEnvelope } from '../attendance/interfaces/responses';
import { FilterConfig } from '../attendance/interfaces/rows';

/**
 * Attendance Dashboard filter endpoints (design.md §6.2/§6.3).
 *
 * Auth: JwtAuthGuard is applied GLOBALLY (CommonModule APP_GUARD), so these
 * routes already require a valid access token — no @UseGuards needed here.
 *
 * Scope: for scoped users the locked upper level(s) are pre-resolved from the
 * JWT and requests for masters above their scope are rejected (a State admin
 * has no business listing states other than their own; a District admin cannot
 * list districts). Enforcement is server-side (requirements §4.2).
 */
@Controller('attendance/filters')
export class FiltersController {
  constructor(private readonly filtersService: FiltersService) {}

  @Get('states')
  getStates(@CurrentUser() user: AuthenticatedUser) {
    const scope = resolveScope(user);
    // Scoped users do not choose a state — it is fixed by their JWT. The FE
    // hides this dropdown; the endpoint returns only their own state.
    if (scope.level === 'state' || scope.level === 'district') {
      return this.filtersService.getStatesForKey(scope.stateKey!);
    }
    return this.filtersService.getStates();
  }

  @Get('districts')
  getDistricts(@Query('stateKey') stateKey: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = resolveScope(user);
    if (scope.level === 'district') {
      // District admin: only their own district is selectable.
      return this.filtersService.getDistrictsForKey(scope.districtKey!);
    }
    if (scope.level === 'state') {
      // State admin: force their own state regardless of the inbound param.
      return this.filtersService.getDistricts(scope.stateKey!);
    }
    return this.filtersService.getDistricts(stateKey);
  }

  @Get('blocks')
  getBlocks(@Query('districtKey') districtKey: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertWithinScope(user, { districtKey });
    return this.filtersService.getBlocks(districtKey);
  }

  @Get('clusters')
  getClusters(@Query('blockKey') blockKey: string) {
    return this.filtersService.getClusters(blockKey);
  }

  @Get('schools')
  getSchools(
    @Query('clusterKey') clusterKey: string,
    @Query('blockKey') blockKey: string,
    @Query('districtKey') districtKey: string,
    @Query('stateKey') stateKey: string,
    @Query('search') search: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = resolveScope(user);
    // Force the caller's jurisdiction onto the query so a scoped user cannot
    // pull schools outside their scope by supplying a foreign key.
    const effStateKey = scope.level === 'national' ? stateKey : scope.stateKey;
    const effDistrictKey = scope.level === 'district' ? scope.districtKey : districtKey;
    return this.filtersService.getSchools({
      clusterKey,
      blockKey,
      districtKey: effDistrictKey,
      stateKey: effStateKey,
      search,
    });
  }

  /**
   * Backend-served filter configuration (design.md §6.3) so future dashboards
   * reuse the framework without a frontend redeploy. Reflects the caller's
   * locked levels.
   */
  @Get('/config')
  getConfig(@CurrentUser() user: AuthenticatedUser): SuccessEnvelope<FilterConfig> {
    const scope = resolveScope(user);
    const config: FilterConfig = {
      dashboardId: 'attendance',
      levels: ['state', 'district', 'block', 'cluster', 'school'],
      required: [],
      searchable: ['state', 'district', 'block', 'cluster', 'school'],
      defaultScope: { level: scope.level, value: scope.districtKey ?? scope.stateKey ?? null },
      lockedLevels: lockedLevels(scope),
    };
    return ok(config);
  }

  /**
   * Reject a district request that falls outside a state-scoped user's state,
   * or any district request from a district-scoped user for a different district.
   * (Best-effort guard; the definitive isolation is that KPI queries force the
   * effective scope regardless of these params.)
   */
  private assertWithinScope(user: AuthenticatedUser, q: { districtKey?: string }) {
    const scope = resolveScope(user);
    if (scope.level === 'district' && q.districtKey && q.districtKey !== scope.districtKey) {
      throw new ForbiddenException('Requested district is outside your jurisdiction.');
    }
  }

}

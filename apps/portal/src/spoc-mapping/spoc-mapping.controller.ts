import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { Roles, CurrentUser, AuthenticatedUser } from '@rvsk/common';
import { SpocMappingService } from './spoc-mapping.service';
import { AssignStatesDto, ReassignStateDto, DeactivateStateDto } from './dto';

/**
 * RVSK-GRV-SPOC-003 — State–SPOC Assignment admin API.
 * All routes restricted to Super_Admin / RVSK_Admin (RolesGuard is global).
 * Served under /api/v1/spoc-mappings.
 */
@Controller('spoc-mappings')
@Roles('Super_Admin', 'RVSK_Admin')
export class SpocMappingController {
  constructor(private readonly spocMappingService: SpocMappingService) {}

  /** All States with their current SPOC (incl. unassigned). */
  @Get()
  async list() {
    return this.spocMappingService.listAssignments();
  }

  /** Active RVSK_SPOC users for the picker. */
  @Get('spocs')
  async listSpocs() {
    return this.spocMappingService.listSpocUsers();
  }

  /** Assignment history for a single State. */
  @Get(':stateKey/history')
  async history(@Param('stateKey') stateKey: string) {
    return this.spocMappingService.getStateHistory(stateKey);
  }

  /** Assign / reassign one or more States to a SPOC. */
  @Post('assign')
  async assign(
    @Body() dto: AssignStatesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.spocMappingService.assignStates(
      user.userId,
      dto.spocUserId,
      dto.stateKeys,
      dto.note,
    );
  }

  /** Reassign a single State to a different SPOC. */
  @Post('reassign')
  async reassign(
    @Body() dto: ReassignStateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.spocMappingService.reassignState(
      user.userId,
      dto.stateKey,
      dto.spocUserId,
      dto.note,
    );
  }

  /** Retire a State's active mapping. */
  @Post(':stateKey/deactivate')
  async deactivate(
    @Param('stateKey') stateKey: string,
    @Body() dto: DeactivateStateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.spocMappingService.deactivateState(
      user.userId,
      stateKey,
      dto?.note,
    );
  }
}

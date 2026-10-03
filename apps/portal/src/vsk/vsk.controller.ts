import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Roles, CurrentUser, AuthenticatedUser, AppException } from '@rvsk/common';

import { VskService } from './vsk.service';
import { VskProfileDto } from './dto/vsk-profile.dto';
import { VskPmuDto } from './dto/vsk-pmu.dto';
import { VskSoftwareDto } from './dto/vsk-software.dto';
import { VskInfraDto } from './dto/vsk-infra.dto';
import { VskOfficerHistory } from './entities/vsk-officer-history.entity';
import { VskCommitteeMember } from './entities/vsk-committee-member.entity';
import { FileStorageService } from '../storage/file-storage.service';
import { VskPdfService } from './vsk-pdf.service';
import { VskExportService, AdminStateRow } from './vsk-export.service';
import { MasterDataService } from '../master-data/master-data.service';

@Controller('vsk')
export class VskController {
  constructor(
    private readonly vskService: VskService,
    private readonly fileStorage: FileStorageService,
    private readonly pdfService: VskPdfService,
    private readonly vskExport: VskExportService,
    private readonly masterData: MasterDataService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // PROFILE
  // ═══════════════════════════════════════════════════════════════

  @Get('profile')
  @Roles('State_Admin')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const stateCode = this.extractStateCode(user);
    const profile = await this.vskService.getProfile(stateCode);
    return profile;
  }

  @Post('profile')
  @Roles('State_Admin')
  @HttpCode(HttpStatus.CREATED)
  async createProfile(
    @Body() dto: VskProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.saveProfile(stateCode, dto, user.userId, user.username);
  }

  @Put('profile')
  @Roles('State_Admin')
  async updateProfile(
    @Body() dto: VskProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.saveProfile(stateCode, dto, user.userId, user.username);
  }

  // ═══════════════════════════════════════════════════════════════
  // WIZARD FLOW (auto-save, save-draft, save-next)
  // ═══════════════════════════════════════════════════════════════

  @Put('auto-save')
  @Roles('State_Admin')
  @HttpCode(200)
  async autoSave(
    @Body() body: { step: number; data: Record<string, unknown> },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    // Save relevant section based on step
    await this.saveStepData(stateCode, body.step, body.data, user.userId, user.username);
    return { success: true };
  }

  @Put('save-draft')
  @Roles('State_Admin')
  @HttpCode(200)
  async saveDraft(
    @Body() body: { step: number; data: Record<string, unknown> },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    await this.saveStepData(stateCode, body.step, body.data, user.userId, user.username);
    return { success: true };
  }

  @Put('save-next')
  @Roles('State_Admin')
  @HttpCode(200)
  async saveAndNext(
    @Body() body: { step: number; data: Record<string, unknown> },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    await this.saveStepData(stateCode, body.step, body.data, user.userId, user.username);

    // Update step status to COMPLETE
    const stepStatusField = `step${body.step}Status` as keyof VskProfileDto;
    await this.vskService.saveProfile(
      stateCode,
      { [stepStatusField]: 'COMPLETE' } as Partial<VskProfileDto> as VskProfileDto,
      user.userId,
      user.username,
    );

    return {
      completedStep: body.step,
      nextStep: body.step + 1,
      stepStatus: 'COMPLETE',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // OFFICERS
  // ═══════════════════════════════════════════════════════════════

  @Get('officers')
  @Roles('State_Admin')
  async getActiveOfficers(@CurrentUser() user: AuthenticatedUser) {
    const stateCode = this.extractStateCode(user);
    return this.vskService.getActiveOfficers(stateCode);
  }

  @Get('officers/history')
  @Roles('State_Admin')
  async getOfficerHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('role') role?: string,
  ) {
    const stateCode = this.extractStateCode(user);
    return this.vskService.getOfficerHistory(stateCode, role);
  }

  @Post('officers')
  @Roles('State_Admin')
  @HttpCode(HttpStatus.CREATED)
  async createOfficer(
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.createOfficer(stateCode, body, user.userId);
  }

  @Post('officers/appoint-new')
  @Roles('State_Admin')
  @HttpCode(HttpStatus.CREATED)
  async appointNewOfficer(
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.appointNewOfficer(stateCode, body, user.userId);
  }

  @Put('officers/:id/typo-correction')
  @Roles('State_Admin')
  async typoCorrection(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.typoCorrection(id, body, user.userId);
  }

  // ═══════════════════════════════════════════════════════════════
  // COMMITTEE MEMBERS
  // ═══════════════════════════════════════════════════════════════

  @Get('committee-members')
  @Roles('State_Admin')
  async getCommitteeMembers(@CurrentUser() user: AuthenticatedUser) {
    const stateCode = this.extractStateCode(user);
    return this.vskService.getCommitteeMembers(stateCode);
  }

  @Post('committee-members')
  @Roles('State_Admin')
  @HttpCode(HttpStatus.CREATED)
  async addCommitteeMember(
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.addCommitteeMember(stateCode, body, user.userId);
  }

  @Put('committee-members/:id')
  @Roles('State_Admin')
  async updateCommitteeMember(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.updateCommitteeMember(id, body, user.userId);
  }

  @Delete('committee-members/:id')
  @Roles('State_Admin')
  async removeCommitteeMember(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    await this.vskService.removeCommitteeMember(id);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════
  // PMU
  // ═══════════════════════════════════════════════════════════════

  @Get('pmu')
  @Roles('State_Admin')
  async getPmu(@CurrentUser() user: AuthenticatedUser) {
    const stateCode = this.extractStateCode(user);
    return this.vskService.getPmu(stateCode);
  }

  @Post('pmu')
  @Roles('State_Admin')
  @HttpCode(HttpStatus.CREATED)
  async createPmu(
    @Body() dto: VskPmuDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.savePmu(stateCode, dto, user.userId, user.username);
  }

  @Put('pmu')
  @Roles('State_Admin')
  async updatePmu(
    @Body() dto: VskPmuDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.savePmu(stateCode, dto, user.userId, user.username);
  }

  // ═══════════════════════════════════════════════════════════════
  // SOFTWARE
  // ═══════════════════════════════════════════════════════════════

  @Get('software')
  @Roles('State_Admin')
  async getSoftware(@CurrentUser() user: AuthenticatedUser) {
    const stateCode = this.extractStateCode(user);
    return this.vskService.getSoftware(stateCode);
  }

  @Post('software')
  @Roles('State_Admin')
  @HttpCode(HttpStatus.CREATED)
  async createSoftware(
    @Body() dto: VskSoftwareDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.saveSoftware(stateCode, dto, user.userId, user.username);
  }

  @Put('software')
  @Roles('State_Admin')
  async updateSoftware(
    @Body() dto: VskSoftwareDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.saveSoftware(stateCode, dto, user.userId, user.username);
  }

  // ═══════════════════════════════════════════════════════════════
  // INFRA
  // ═══════════════════════════════════════════════════════════════

  @Get('infra')
  @Roles('State_Admin')
  async getInfra(@CurrentUser() user: AuthenticatedUser) {
    const stateCode = this.extractStateCode(user);
    return this.vskService.getInfra(stateCode);
  }

  @Post('infra')
  @Roles('State_Admin')
  @HttpCode(HttpStatus.CREATED)
  async createInfra(
    @Body() dto: VskInfraDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.saveInfra(stateCode, dto, user.userId, user.username);
  }

  @Put('infra')
  @Roles('State_Admin')
  async updateInfra(
    @Body() dto: VskInfraDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);
    return this.vskService.saveInfra(stateCode, dto, user.userId, user.username);
  }

  @Post('infra/upload-image')
  @Roles('State_Admin')
  @UseInterceptors(FileInterceptor('file'))
  async uploadInfraImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('imageType') imageType: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const stateCode = this.extractStateCode(user);
    await this.enforceSubmissionLock(stateCode);

    // Only allow the three known infra image slots.
    const slot = ['room', 'screen', 'workstation'].includes((imageType || '').toLowerCase())
      ? imageType.toLowerCase()
      : 'misc';

    const stored = await this.fileStorage.saveImage(file, ['vsk', stateCode, slot]);

    // Persist the URL onto the infra record so it survives reloads and shows on
    // the Review page / PDF without a separate save.
    const field =
      slot === 'room'
        ? 'roomImageUrl'
        : slot === 'screen'
          ? 'screenImageUrl'
          : slot === 'workstation'
            ? 'workstationImageUrl'
            : null;
    if (field) {
      await this.vskService.saveInfra(
        stateCode,
        { [field]: stored.url } as Partial<VskInfraDto> as VskInfraDto,
        user.userId,
        user.username,
      );
    }

    return { imageUrl: stored.url, imageType: slot };
  }

  // ═══════════════════════════════════════════════════════════════
  // REVIEW & SUBMIT (Step 5)
  // ═══════════════════════════════════════════════════════════════

  @Get('review-summary')
  @Roles('State_Admin')
  async getReviewSummary(@CurrentUser() user: AuthenticatedUser) {
    const stateCode = this.extractStateCode(user);
    const [details, officers, committeeMembers] = await Promise.all([
      this.vskService.getFullDetails(stateCode),
      this.vskService.getActiveOfficers(stateCode),
      this.vskService.getCommitteeMembers(stateCode),
    ]);

    const profile = details.profile;
    const allStepsComplete =
      profile?.step1Status === 'COMPLETE' &&
      profile?.step2Status === 'COMPLETE' &&
      profile?.step3Status === 'COMPLETE' &&
      profile?.step4Status === 'COMPLETE';

    return {
      profile: details.profile,
      // Normalize isActive boolean → 1/0 so the frontend's `isActive === 1`
      // filtering in Step5 matches reliably.
      officers: officers.map((o) => this.mapOfficerForClient(o)),
      committeeMembers: committeeMembers.map((m) => this.mapCommitteeForClient(m)),
      infra: details.infra,
      software: details.software,
      pmu: details.pmu,
      allStepsComplete: allStepsComplete || false,
    };
  }

  @Get('review-pdf')
  @Roles('State_Admin')
  async downloadReviewPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const stateCode = this.extractStateCode(user);
    const { pdf, safeName } = await this.buildStatePdf(stateCode);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="VSK_Profile_${safeName}.pdf"`,
      'Content-Length': String(pdf.length),
    });
    res.end(pdf);
  }

  @Post('submit')
  @Roles('State_Admin')
  @HttpCode(200)
  async submitProfile(@CurrentUser() user: AuthenticatedUser) {
    const stateCode = this.extractStateCode(user);
    // Set submission status to SUBMITTED
    await this.vskService.saveProfile(
      stateCode,
      { submissionStatus: 'SUBMITTED' } as VskProfileDto,
      user.userId,
      user.username,
    );
    return { success: true, message: 'VSK profile submitted successfully' };
  }

  /**
   * Re-open a submitted VSK profile for editing. Flips submissionStatus back to
   * DRAFT so the State Admin can edit and re-submit. All step data and officer
   * history are preserved (only the submission flag changes). Returns a 400 if
   * the profile is not currently submitted.
   */
  @Post('reopen')
  @Roles('State_Admin')
  @HttpCode(200)
  async reopenProfile(@CurrentUser() user: AuthenticatedUser) {
    const stateCode = this.extractStateCode(user);
    const profile = await this.vskService.getProfile(stateCode);
    if (!profile || profile.submissionStatus !== 'SUBMITTED') {
      throw new AppException(
        'VSK profile is not submitted, so there is nothing to re-open.',
        HttpStatus.BAD_REQUEST,
        'NOT_SUBMITTED',
      );
    }
    await this.vskService.saveProfile(
      stateCode,
      { submissionStatus: 'DRAFT' } as VskProfileDto,
      user.userId,
      user.username,
    );
    return { success: true, message: 'VSK profile re-opened for editing' };
  }

  // ═══════════════════════════════════════════════════════════════
  // FULL DETAILS (legacy)
  // ═══════════════════════════════════════════════════════════════

  @Get('details')
  @Roles('State_Admin')
  async getFullDetails(@CurrentUser() user: AuthenticatedUser) {
    const stateCode = this.extractStateCode(user);
    return this.vskService.getFullDetails(stateCode);
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Get('admin/dashboard')
  @Roles('Super_Admin', 'RVSK_Admin')
  async getAdminDashboard() {
    const [summaries, stateNameMap] = await Promise.all([
      this.vskService.getStateProgressSummaries(),
      this.masterData.getStateNameMap(),
    ]);

    // Total universe of states/UTs from master data (fallback to 36 if the
    // view is unavailable in a given environment).
    const totalStates = Object.keys(stateNameMap).length || 36;

    const statesWithProfile = summaries.length;
    const statesSubmitted = summaries.filter((s) => s.overallStatus === 'SUBMITTED').length;
    const statesCompleted = summaries.filter((s) => s.overallStatus === 'COMPLETED').length;
    const statesInProgress = summaries.filter((s) => s.overallStatus === 'IN_PROGRESS').length;
    // "Pending" = states that have not started a profile at all.
    const statesPending = Math.max(0, totalStates - statesWithProfile);

    // Completion % = share of all states that have fully submitted.
    const completionPercentage =
      totalStates > 0 ? Math.round((statesSubmitted / totalStates) * 100) : 0;

    return {
      totalStates,
      statesSubmitted,
      statesCompleted,
      statesInProgress,
      statesDraft: statesInProgress,
      statesPending,
      completionPercentage,
      statesWithProfile,
      statesWithInfra: summaries.filter((s) => s.hasInfra).length,
      statesWithSoftware: summaries.filter((s) => s.hasSoftware).length,
      statesWithPmu: summaries.filter((s) => s.hasPmu).length,
      statesWithOfficers: summaries.filter((s) => s.hasSecretary).length,
    };
  }

  @Get('admin/states')
  @Roles('Super_Admin', 'RVSK_Admin')
  async getAdminStates(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('search') search?: string,
    @Query('stateCode') stateCode?: string,
    @Query('status') status?: string,
  ) {
    const rows = await this.buildAdminStateRows({ search, stateCode, status });

    const pageNum = Math.max(0, parseInt(page ?? '0', 10) || 0);
    const sizeNum = Math.min(200, Math.max(1, parseInt(size ?? '20', 10) || 20));
    const start = pageNum * sizeNum;
    const content = rows.slice(start, start + sizeNum);

    return { content, totalElements: rows.length };
  }

  /**
   * Download a state's VSK Profile PDF (admin view). Same document the State
   * Admin gets from the review page — reuses VskPdfService. Only meaningful for
   * states that have submitted; the dashboard gates the button accordingly.
   */
  @Get('admin/states/:stateCode/pdf')
  @Roles('Super_Admin', 'RVSK_Admin')
  async downloadStatePdf(
    @Param('stateCode') stateCode: string,
    @Res() res: Response,
  ) {
    const { pdf, safeName } = await this.buildStatePdf(stateCode);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="VSK_Profile_${safeName}.pdf"`,
      'Content-Length': String(pdf.length),
    });
    res.end(pdf);
  }

  @Get('admin/states/:stateCode')
  @Roles('Super_Admin', 'RVSK_Admin')
  async getAdminStateDetails(@Param('stateCode') stateCode: string) {
    const [details, officers, committeeMembers, stateName] = await Promise.all([
      this.vskService.getFullDetails(stateCode),
      this.vskService.getActiveOfficers(stateCode),
      this.vskService.getCommitteeMembers(stateCode),
      this.masterData.getStateNameByCode(stateCode),
    ]);
    return {
      stateCode,
      stateName: stateName || stateCode,
      ...details,
      officers: officers.map((o) => this.mapOfficerForClient(o)),
      committeeMembers: committeeMembers.map((m) => this.mapCommitteeForClient(m)),
    };
  }

  @Get('admin/export')
  @Roles('Super_Admin', 'RVSK_Admin')
  async exportVskData(
    @Res() res: Response,
    @Query('stateCode') stateCode?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const rows = await this.buildAdminStateRows({ search, stateCode, status });
    const buffer = await this.vskExport.buildStatesWorkbook(rows);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="vsk_data_export.xlsx"',
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════

  private extractStateCode(user: AuthenticatedUser): string {
    if (!user.stateCode || user.stateCode.trim() === '') {
      throw new AppException(
        'User has no state assigned',
        HttpStatus.BAD_REQUEST,
        'NO_STATE_ASSIGNED',
      );
    }
    return user.stateCode;
  }

  /**
   * Build the VSK Profile PDF for a state (shared by the State review download
   * and the admin dashboard download). Returns the buffer plus a filesystem-safe
   * state name for the download filename.
   */
  private async buildStatePdf(stateCode: string): Promise<{ pdf: Buffer; safeName: string }> {
    const [details, officers, committeeMembers, stateName] = await Promise.all([
      this.vskService.getFullDetails(stateCode),
      this.vskService.getActiveOfficers(stateCode),
      this.vskService.getCommitteeMembers(stateCode),
      this.masterData.getStateNameByCode(stateCode),
    ]);

    const pdf = await this.pdfService.generate({
      stateCode,
      stateName: stateName || stateCode,
      profile: details.profile,
      officers: officers.map((o) => ({
        officerRole: o.officerRole,
        name: o.name,
        designation: o.designation,
        phone: o.phone,
        whatsapp: o.whatsapp,
        email: o.email,
      })),
      committeeMembers: committeeMembers.map((m) => ({
        name: m.name,
        designation: m.designation,
        phone: m.phone,
        email: m.email,
      })),
      infra: details.infra,
      software: details.software,
      pmu: details.pmu,
    });

    const safeName = (stateName || stateCode).replace(/[^a-zA-Z0-9_-]+/g, '_');
    return { pdf, safeName };
  }

  /**
   * Map an officer entity to the client shape, normalizing the boolean
   * `isActive` column to 1/0 so the frontend (which filters on `=== 1`) works.
   */
  private mapOfficerForClient(o: VskOfficerHistory) {
    return {
      id: o.id,
      stateCode: o.stateCode,
      officerRole: o.officerRole,
      name: o.name,
      designation: o.designation,
      phone: o.phone,
      whatsapp: o.whatsapp,
      email: o.email,
      startDate: o.startDate,
      endDate: o.endDate,
      isActive: o.isActive ? 1 : 0,
    };
  }

  private mapCommitteeForClient(m: VskCommitteeMember) {
    return {
      id: m.id,
      stateCode: m.stateCode,
      name: m.name,
      designation: m.designation,
      phone: m.phone,
      whatsapp: m.whatsapp,
      email: m.email,
      isActive: m.isActive ? 1 : 0,
    };
  }

  /**
   * Produce fully-labeled, filtered per-state rows for the admin dashboard
   * table and the Excel export. Shared so both views stay in sync.
   */
  private async buildAdminStateRows(filters: {
    search?: string;
    stateCode?: string;
    status?: string;
  }): Promise<AdminStateRow[]> {
    const [summaries, stateNameMap] = await Promise.all([
      this.vskService.getStateProgressSummaries(),
      this.masterData.getStateNameMap(),
    ]);

    let rows: AdminStateRow[] = summaries.map((s) => ({
      stateCode: s.stateCode,
      stateName: stateNameMap[s.stateCode.toUpperCase()] || s.stateCode,
      step1Status: s.step1Status,
      step2Status: s.step2Status,
      step3Status: s.step3Status,
      step4Status: s.step4Status,
      submissionStatus: s.submissionStatus,
      overallStatus: s.overallStatus,
      completedSteps: s.completedSteps,
      totalSteps: s.totalSteps,
      // Legacy v1 fields the frontend table still reads.
      hasProfile: s.hasProfile,
      hasInfra: s.hasInfra,
      hasSoftware: s.hasSoftware,
      hasPmu: s.hasPmu,
      hasSecretary: s.hasSecretary,
      completedSections: s.completedSteps,
      totalSections: s.totalSteps,
      updatedAt: s.updatedAt ? s.updatedAt.toISOString() : undefined,
    }));

    if (filters.stateCode) {
      const code = filters.stateCode.toUpperCase();
      rows = rows.filter((r) => r.stateCode.toUpperCase() === code);
    }
    if (filters.status) {
      const st = filters.status.toUpperCase();
      rows = rows.filter((r) => r.overallStatus === st);
    }
    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.stateName.toLowerCase().includes(q) ||
          r.stateCode.toLowerCase().includes(q),
      );
    }

    rows.sort((a, b) => a.stateName.localeCompare(b.stateName));
    return rows;
  }

  private async enforceSubmissionLock(stateCode: string): Promise<void> {
    const profile = await this.vskService.getProfile(stateCode);
    if (profile && profile.submissionStatus === 'SUBMITTED') {
      throw new AppException(
        'VSK form has been submitted. No further modifications are allowed.',
        HttpStatus.FORBIDDEN,
        'FORM_SUBMITTED',
      );
    }
  }

  private async saveStepData(
    stateCode: string,
    step: number,
    data: Record<string, unknown>,
    userId: string,
    username: string,
  ): Promise<void> {
    switch (step) {
      case 1:
        // Step 1 = Profile
        await this.vskService.saveProfile(stateCode, data as any, userId, username);
        break;
      case 2:
        // Step 2 = Infrastructure
        await this.vskService.saveInfra(stateCode, data as any, userId, username);
        break;
      case 3:
        // Step 3 = Software
        await this.vskService.saveSoftware(stateCode, data as any, userId, username);
        break;
      case 4:
        // Step 4 = PMU
        await this.vskService.savePmu(stateCode, data as any, userId, username);
        break;
      default:
        break;
    }
  }
}

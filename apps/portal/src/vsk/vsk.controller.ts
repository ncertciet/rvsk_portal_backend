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

@Controller('api/v1/vsk')
export class VskController {
  constructor(private readonly vskService: VskService) {}

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
    // TODO: Implement file storage (OCI Object Storage or local filesystem)
    const imageUrl = `/uploads/vsk/${user.stateCode}/${imageType}_${Date.now()}.${file?.originalname?.split('.').pop() || 'jpg'}`;
    return { imageUrl, imageType };
  }

  // ═══════════════════════════════════════════════════════════════
  // REVIEW & SUBMIT (Step 5)
  // ═══════════════════════════════════════════════════════════════

  @Get('review-summary')
  @Roles('State_Admin')
  async getReviewSummary(@CurrentUser() user: AuthenticatedUser) {
    const stateCode = this.extractStateCode(user);
    const details = await this.vskService.getFullDetails(stateCode);

    const profile = details.profile;
    const allStepsComplete =
      profile?.step1Status === 'COMPLETE' &&
      profile?.step2Status === 'COMPLETE' &&
      profile?.step3Status === 'COMPLETE' &&
      profile?.step4Status === 'COMPLETE';

    return {
      profile: details.profile,
      officers: [], // TODO: load from officers entity
      committeeMembers: [], // TODO: load from committee entity
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
    // TODO: Implement PDF generation
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=vsk_review_${user.stateCode}.pdf`,
    });
    res.send(Buffer.from('PDF generation not yet implemented'));
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
  async getAdminDashboard(@CurrentUser() user: AuthenticatedUser) {
    // Return dashboard KPI data
    // TODO: Implement actual aggregation queries
    return {
      totalStates: 36,
      statesSubmitted: 0,
      statesDraft: 0,
      statesPending: 36,
      completionPercentage: 0,
      statesWithProfile: 0,
      statesWithInfra: 0,
      statesWithSoftware: 0,
      statesWithPmu: 0,
      statesWithOfficers: 0,
    };
  }

  @Get('admin/states')
  @Roles('Super_Admin', 'RVSK_Admin')
  async getAdminStates(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('search') search?: string,
    @Query('stateCode') stateCode?: string,
    @Query('region') region?: string,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    // TODO: Implement actual query with filters
    return { content: [], totalElements: 0 };
  }

  @Get('admin/states/:stateCode')
  @Roles('Super_Admin', 'RVSK_Admin')
  async getAdminStateDetails(@Param('stateCode') stateCode: string) {
    const details = await this.vskService.getFullDetails(stateCode);
    return {
      stateCode,
      stateName: stateCode, // TODO: resolve from master data
      ...details,
      officers: [],
      committeeMembers: [],
    };
  }

  @Get('admin/export')
  @Roles('Super_Admin', 'RVSK_Admin')
  async exportVskData(
    @Query('format') format: string = 'xlsx',
    @Query('stateCode') stateCode?: string,
    @Query('region') region?: string,
    @Query('status') status?: string,
    @Res() res?: Response,
  ) {
    // TODO: Implement actual export
    const contentType = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename=vsk_export.${ext}`,
    });
    res.send(Buffer.from('Export not yet implemented'));
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

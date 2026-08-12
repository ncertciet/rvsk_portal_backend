import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  Public,
  CurrentUser,
  Roles,
  AuthenticatedUser,
  AppException,
} from '@rvsk/common';
import { GrievanceService } from './grievance.service';
import { GrievanceCategoryService } from '../categories/category.service';
import { GrievanceFileService } from '../grievance-attachments/file.service';
import { CreateGrievanceDto, UpdateStatusDto, AddResponseDto } from './dto';

@Controller('api/v1/grievances')
export class GrievanceController {
  constructor(
    private readonly grievanceService: GrievanceService,
    private readonly categoryService: GrievanceCategoryService,
    private readonly fileService: GrievanceFileService,
  ) {}

  /**
   * GET /api/v1/grievances/categories — Public endpoint returning the category tree.
   */
  @Public()
  @Get('categories')
  async getCategories() {
    return this.categoryService.getCategoryTree();
  }

  /**
   * GET /api/v1/grievances/dashboard — Dashboard KPIs for the authenticated user.
   */
  @Get('dashboard')
  async getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.grievanceService.getDashboard(
      user.userId,
      user.role,
      user.stateCode,
    );
  }

  /**
   * GET /api/v1/grievances/notifications/count — Pending action notification count.
   */
  @Get('notifications/count')
  async getNotificationCount(@CurrentUser() user: AuthenticatedUser) {
    return this.grievanceService.getNotificationCount(user.userId, user.role);
  }

  /**
   * POST /api/v1/grievances — Create a new grievance.
   */
  @Post()
  async createGrievance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGrievanceDto,
  ) {
    return this.grievanceService.createGrievance(
      user.userId,
      user.stateCode,
      null,
      dto.category,
      dto.subCategory,
      dto.subject,
      dto.description,
    );
  }

  /**
   * GET /api/v1/grievances — List grievances with pagination, search, and filters.
   */
  @Get()
  async listGrievances(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.grievanceService.listGrievances(
      user.userId,
      user.role,
      user.stateCode,
      search,
      status,
      category,
      page,
      size,
    );
  }

  /**
   * POST /api/v1/grievances/categories — Add a new category (Admin only).
   */
  @Post('categories')
  @Roles('Super_Admin', 'RVSK_Admin')
  async addCategory(
    @Body() body: { code: string; label: string; parentCode?: string; sortOrder?: number },
  ) {
    return this.categoryService.addCategory(body.code, body.label, body.parentCode, body.sortOrder);
  }

  /**
   * PUT /api/v1/grievances/categories/:code — Edit a category (Admin only).
   */
  @Put('categories/:code')
  @Roles('Super_Admin', 'RVSK_Admin')
  async editCategory(
    @Param('code') code: string,
    @Body() body: { label?: string; sortOrder?: number; isActive?: boolean },
  ) {
    return this.categoryService.editCategory(code, body.label, body.sortOrder, body.isActive);
  }

  /**
   * GET /api/v1/grievances/:id — Get grievance detail with responses and history.
   */
  @Get(':id')
  async getGrievanceDetail(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const detail = await this.grievanceService.getGrievanceDetail(
      id,
      user.userId,
      user.role,
    );

    if (!detail) {
      throw new AppException(
        'Grievance not found',
        HttpStatus.NOT_FOUND,
        'GRIEVANCE_NOT_FOUND',
      );
    }

    return detail;
  }

  /**
   * PUT /api/v1/grievances/:id/status — Update grievance status (Admin/SPOC only).
   * Frontend sends { status, comment } or { newStatus, comment }.
   */
  @Put(':id/status')
  @Roles('Super_Admin', 'RVSK_Admin', 'RVSK_SPOC')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const effectiveStatus = dto.newStatus || dto.status || '';
    return this.grievanceService.updateStatus(
      id,
      effectiveStatus,
      user.userId,
      dto.comment,
    );
  }

  /**
   * POST /api/v1/grievances/:id/responses — Add a response to a grievance.
   */
  @Post(':id/responses')
  async addResponse(
    @Param('id') id: string,
    @Body() dto: AddResponseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.grievanceService.addResponse(id, dto.responseText, user.userId);
  }

  /**
   * POST /api/v1/grievances/:id/response — Add a response (singular alias for frontend compatibility).
   */
  @Post(':id/response')
  async addResponseSingular(
    @Param('id') id: string,
    @Body() dto: AddResponseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.grievanceService.addResponse(id, dto.responseText, user.userId);
  }

  /**
   * POST /api/v1/grievances/:id/notes — Add an internal note (Admin/SPOC only).
   */
  @Post(':id/notes')
  @Roles('Super_Admin', 'RVSK_Admin', 'RVSK_SPOC')
  async addInternalNote(
    @Param('id') id: string,
    @Body() body: { note: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.grievanceService.addInternalNote(id, body.note, user.userId);
  }

  /**
   * PUT /api/v1/grievances/:id/reopen — Reopen a grievance (from RESPONSE_PROVIDED).
   */
  @Put(':id/reopen')
  async reopen(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.grievanceService.reopen(id, user.userId, body.reason);
  }

  /**
   * POST /api/v1/grievances/:id/reopen — Reopen (POST alias for frontend compatibility).
   */
  @Post(':id/reopen')
  async reopenPost(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.grievanceService.reopen(id, user.userId, body.reason);
  }

  /**
   * PUT /api/v1/grievances/:id/close — Close a grievance (from RESPONSE_PROVIDED).
   */
  @Put(':id/close')
  async close(
    @Param('id') id: string,
    @Body() body: { comment?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.grievanceService.close(id, user.userId, body.comment);
  }

  /**
   * POST /api/v1/grievances/:id/close — Close (POST alias for frontend compatibility).
   */
  @Post(':id/close')
  async closePost(
    @Param('id') id: string,
    @Body() body: { comment?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.grievanceService.close(id, user.userId, body.comment);
  }

  /**
   * POST /api/v1/grievances/:id/attachments — Upload a file attachment.
   */
  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fileService.upload(id, file, user.userId);
  }

  /**
   * GET /api/v1/grievances/attachments/:fileId — Download a file attachment (legacy route).
   */
  @Get('attachments/:fileId')
  async downloadAttachment(
    @Param('fileId') fileId: string,
  ): Promise<StreamableFile> {
    return this.fileService.download(fileId);
  }

  /**
   * GET /api/v1/grievances/:id/attachments/:fileId — Download attachment (frontend route).
   */
  @Get(':id/attachments/:fileId')
  async downloadAttachmentByGrievance(
    @Param('fileId') fileId: string,
  ): Promise<StreamableFile> {
    return this.fileService.download(fileId);
  }
}

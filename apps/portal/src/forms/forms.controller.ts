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
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Response } from 'express';
import {
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '@rvsk/common';
import { FormService } from './form.service';
import { FormQuestionService } from '../questions/question.service';
import { FormResponseService } from '../responses/response.service';
import { FormExportService } from '../export/export.service';
import { FormCreateDto } from './dto/form-create.dto';
import { PublishDto } from './dto/publish.dto';
import { QuestionDto } from '../questions/dto/question.dto';
import { ReorderQuestionsDto } from '../questions/dto/reorder-questions.dto';
import { SubmitResponseDto } from '../responses/dto/submit-response.dto';

@Controller('forms')
export class FormsController {
  constructor(
    private readonly formService: FormService,
    private readonly questionService: FormQuestionService,
    private readonly responseService: FormResponseService,
    private readonly exportService: FormExportService,
  ) {}

  // ─── Form CRUD ──────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/forms — Create a new form (Admin only).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Post()
  async createForm(
    @Body() dto: FormCreateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.formService.createForm(dto, user.userId);
  }

  /**
   * GET /api/v1/forms — List forms with pagination, status filter, and search.
   */
  @Get()
  async listForms(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page?: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size?: number,
  ) {
    return this.formService.listForms(status, search, page, size);
  }

  /**
   * GET /api/v1/forms/my-forms — Forms assigned to the current user's state.
   * Declared before :id so "my-forms" is not captured as a form id.
   */
  @Get('my-forms')
  async getMyForms(@CurrentUser() user: AuthenticatedUser) {
    return this.formService.getMyForms(user.stateKey ?? null);
  }

  /**
   * GET /api/v1/forms/:id — Get form details by ID.
   */
  @Get(':id')
  async getForm(@Param('id') id: string) {
    return this.formService.getForm(id);
  }

  /**
   * PUT /api/v1/forms/:id — Update a form (Admin only, DRAFT only).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Put(':id')
  async updateForm(
    @Param('id') id: string,
    @Body() dto: FormCreateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.formService.updateForm(id, dto, user.userId);
  }

  /**
   * DELETE /api/v1/forms/:id — Delete a form (Admin only, DRAFT only).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Delete(':id')
  async deleteForm(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.formService.deleteForm(id, user.userId);
  }

  /**
   * POST /api/v1/forms/:id/publish — Publish a form to selected states (Admin only).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Post(':id/publish')
  async publishForm(
    @Param('id') id: string,
    @Body() dto: PublishDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.formService.publishForm(id, dto, user.userId);
  }

  /**
   * POST /api/v1/forms/:id/close — Close a published form (Admin only).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Post(':id/close')
  async closeForm(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.formService.closeForm(id, user.userId);
  }

  /**
   * POST /api/v1/forms/:id/remind — Send a submission reminder to states whose
   * submission is still PENDING (Super Admin / RVSK Admin). RVSK-NOTIFY-EMAIL-003.
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Post(':id/remind')
  async remindForm(@Param('id') id: string) {
    return this.formService.remind(id);
  }

  // ─── Questions ──────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/forms/:id/questions — Add a question to a form (Admin only).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Post(':id/questions')
  async addQuestion(
    @Param('id') formId: string,
    @Body() dto: QuestionDto,
  ) {
    return this.questionService.addQuestion(formId, dto);
  }

  /**
   * GET /api/v1/forms/:id/questions — Get all questions for a form.
   */
  @Get(':id/questions')
  async getQuestions(@Param('id') formId: string) {
    return this.questionService.getQuestions(formId);
  }

  /**
   * PUT /api/v1/forms/:id/questions/:qid — Update a question (Admin only).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Put(':id/questions/:qid')
  async updateQuestion(
    @Param('qid') questionId: string,
    @Body() dto: QuestionDto,
  ) {
    return this.questionService.updateQuestion(questionId, dto);
  }

  /**
   * DELETE /api/v1/forms/:id/questions/:qid — Delete a question (Admin only).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Delete(':id/questions/:qid')
  async deleteQuestion(@Param('qid') questionId: string) {
    return this.questionService.deleteQuestion(questionId);
  }

  /**
   * PUT /api/v1/forms/:id/questions/reorder — Reorder questions (Admin only).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Put(':id/questions/reorder')
  async reorderQuestions(
    @Param('id') formId: string,
    @Body() body: ReorderQuestionsDto,
  ) {
    return this.questionService.reorderQuestions(formId, body.orderedIds);
  }

  // ─── Responses ──────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/forms/:id/responses — Submit a form response.
   */
  @Post(':id/responses')
  async submitResponse(
    @Param('id') formId: string,
    @Body() dto: SubmitResponseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.responseService.submitResponse(
      formId,
      dto.answers,
      user.userId,
      user.stateKey ?? null,
    );
  }

  /**
   * GET /api/v1/forms/:id/responses — List responses for a form (paginated).
   */
  @Get(':id/responses')
  async getResponses(
    @Param('id') formId: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('size', new DefaultValuePipe(20), ParseIntPipe) size: number,
  ) {
    return this.responseService.getResponses(formId, page, size);
  }

  /**
   * GET /api/v1/forms/:id/my-response — Get the current user's response for a form.
   */
  @Get(':id/my-response')
  async getMyResponse(
    @Param('id') formId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.responseService.getMyResponse(formId, user.userId);
  }

  // ─── Export ─────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/forms/:id/export/excel — Export form responses as Excel (Admin only).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Get(':id/export/excel')
  async exportExcel(
    @Param('id') formId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.exportToExcel(formId);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=form_${formId}.xlsx`,
    });
    res.send(buffer);
  }

  /**
   * GET /api/v1/forms/:id/export/csv — Export form responses as CSV (Admin only).
   */
  @Roles('Super_Admin', 'RVSK_Admin')
  @Get(':id/export/csv')
  async exportCsv(
    @Param('id') formId: string,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportToCsv(formId);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=form_${formId}.csv`,
    });
    res.send(csv);
  }
}

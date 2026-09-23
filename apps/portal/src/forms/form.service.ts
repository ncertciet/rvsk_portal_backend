import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppException, PageResponse } from '@rvsk/common';
import { Logger } from '@nestjs/common';
import { FormMaster } from './entities/form-master.entity';
import { FormAssignment } from './entities/form-assignment.entity';
import { FormQuestion } from '../questions/entities/form-question.entity';
import { PortalUser } from '../auth/entities/portal-user.entity';
import { FormCreateDto } from './dto/form-create.dto';
import { PublishDto } from './dto/publish.dto';
import { FormDetailResponse } from './dto/form-detail-response.dto';
import { FormListResponse } from './dto/form-list-response.dto';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class FormService {
  private readonly logger = new Logger(FormService.name);

  constructor(
    @InjectRepository(FormMaster)
    private readonly formRepository: Repository<FormMaster>,
    @InjectRepository(FormAssignment)
    private readonly assignmentRepository: Repository<FormAssignment>,
    @InjectRepository(FormQuestion)
    private readonly questionRepository: Repository<FormQuestion>,
    @InjectRepository(PortalUser)
    private readonly userRepository: Repository<PortalUser>,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * RVSK-NOTIFY-EMAIL-003 — notify each given state's users for a form event.
   * Resolves state-level users (State_Admin/State_SPOC) by state_key and emits
   * one notification per state. Non-blocking; per-state failures isolated.
   */
  private async notifyStates(
    eventCode: string,
    form: FormMaster,
    stateKeys: string[],
    refSuffix: string,
  ): Promise<void> {
    const dueClause = form.dueDate
      ? ` (due ${new Date(form.dueDate).toISOString().slice(0, 10)})`
      : '';
    for (const stateKey of stateKeys) {
      const users = await this.userRepository.find({
        where: [
          { stateKey, role: 'State_Admin', isActive: true },
          { stateKey, role: 'State_SPOC', isActive: true },
        ],
      });
      const stateName = users[0]?.stateName || `State ${stateKey}`;
      for (const u of users) {
        const to = u.contactEmail || u.userEmail || '';
        if (!to) {
          continue;
        }
        await this.notificationService.notify(eventCode, {
          to,
          referenceType: 'FORM',
          referenceId: `${form.id}:${stateKey}:${refSuffix}`,
          data: {
            state_name: stateName,
            form_title: form.title,
            due_date: form.dueDate
              ? new Date(form.dueDate).toISOString().slice(0, 10)
              : '',
            due_date_clause: dueClause,
          },
        });
      }
    }
  }

  async createForm(request: FormCreateDto, userId: string): Promise<FormDetailResponse> {
    const form = new FormMaster();
    form.id = uuidv4();
    form.title = request.title;
    form.description = request.description || null;
    form.instructions = request.instructions || null;
    form.status = 'DRAFT';
    form.dueDate = request.dueDate ? new Date(request.dueDate) : null;
    form.createdBy = userId;

    const saved = await this.formRepository.save(form);

    await this.auditService.recordAndLog(
      {
        entityName: 'FORM',
        entityId: saved.id,
        actionType: 'CREATE',
        userId,
        newValues: { title: saved.title, status: saved.status },
      },
      {
        module: 'FORMS',
        action: 'CREATE',
        description: `Created form "${saved.title}"`,
        performedBy: userId,
        entityId: saved.id,
      },
    );

    return this.toDetailResponse(saved, 0);
  }

  async listForms(
    status?: string,
    search?: string,
    page: number = 0,
    size: number = 20,
  ): Promise<PageResponse<FormListResponse>> {
    const queryBuilder = this.formRepository.createQueryBuilder('form');

    if (status) {
      queryBuilder.andWhere('form.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere('UPPER(form.title) LIKE UPPER(:search)', {
        search: `%${search}%`,
      });
    }

    queryBuilder.orderBy('form.createdDate', 'DESC');
    queryBuilder.skip(page * size).take(size);

    const [forms, totalElements] = await queryBuilder.getManyAndCount();

    const content: FormListResponse[] = await Promise.all(
      forms.map(async (form) => {
        const questionCount = await this.questionRepository.count({
          where: { formId: form.id },
        });
        return this.toListResponse(form, questionCount);
      }),
    );

    return new PageResponse(content, totalElements, page, size);
  }

  /**
   * List forms assigned to the given user's state (RVSK-USR-MGMT-001 forms
   * alignment). Joins form_assignment on the user's state_key, returns only
   * PUBLISHED (or CLOSED) forms with the per-state submission status.
   */
  async getMyForms(stateKey: string | null): Promise<Array<{
    id: string;
    title: string;
    description: string | null;
    dueDate: Date | null;
    status: string;
    submissionStatus: string;
    questionCount: number;
  }>> {
    if (!stateKey || !/^\d+$/.test(stateKey)) {
      // Non-geo / national users have no assigned-state forms.
      return [];
    }

    const rows = await this.formRepository.manager.query(
      `SELECT f.id, f.title, f.description, f.due_date AS "dueDate",
              f.status, a.submission_status AS "submissionStatus"
         FROM rvsk_portal.form_assignment a
         JOIN rvsk_portal.form_master f ON f.id = a.form_id
        WHERE a.state_key = $1
          AND f.status IN ('PUBLISHED', 'CLOSED')
        ORDER BY f.due_date NULLS LAST, f.created_date DESC`,
      [stateKey],
    );

    // Attach question counts (small N of assigned forms).
    return Promise.all(
      rows.map(async (r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        dueDate: r.dueDate ?? null,
        status: r.status,
        submissionStatus: r.submissionStatus,
        questionCount: await this.questionRepository.count({ where: { formId: r.id } }),
      })),
    );
  }

  async getForm(id: string): Promise<any> {
    const form = await this.formRepository.findOne({ where: { id } });

    if (!form) {
      throw new AppException(
        'Form not found',
        HttpStatus.NOT_FOUND,
        'FORM_NOT_FOUND',
      );
    }

    const questions = await this.questionRepository.find({
      where: { formId: id },
      order: { displayOrder: 'ASC' },
    });

    const detail = this.toDetailResponse(form, questions.length);
    return { ...detail, questions };
  }

  async updateForm(
    id: string,
    request: FormCreateDto,
    userId: string,
  ): Promise<FormDetailResponse> {
    const form = await this.formRepository.findOne({ where: { id } });

    if (!form) {
      throw new AppException(
        'Form not found',
        HttpStatus.NOT_FOUND,
        'FORM_NOT_FOUND',
      );
    }

    if (form.status !== 'DRAFT') {
      throw new AppException(
        'Operation not allowed on non-DRAFT form',
        HttpStatus.BAD_REQUEST,
        'OPERATION_NOT_ALLOWED',
      );
    }

    form.title = request.title;
    form.description = request.description || null;
    form.instructions = request.instructions || null;
    form.dueDate = request.dueDate ? new Date(request.dueDate) : null;
    form.updatedBy = userId;

    const saved = await this.formRepository.save(form);

    const questionCount = await this.questionRepository.count({
      where: { formId: id },
    });

    return this.toDetailResponse(saved, questionCount);
  }

  async deleteForm(id: string, userId: string): Promise<void> {
    const form = await this.formRepository.findOne({ where: { id } });

    if (!form) {
      throw new AppException(
        'Form not found',
        HttpStatus.NOT_FOUND,
        'FORM_NOT_FOUND',
      );
    }

    if (form.status !== 'DRAFT') {
      throw new AppException(
        'Operation not allowed on non-DRAFT form',
        HttpStatus.BAD_REQUEST,
        'OPERATION_NOT_ALLOWED',
      );
    }

    const deletedTitle = form.title;

    // Delete questions first
    await this.questionRepository.delete({ formId: id });
    // Delete the form
    await this.formRepository.delete({ id });

    await this.auditService.recordAndLog(
      {
        entityName: 'FORM',
        entityId: id,
        actionType: 'DELETE',
        userId,
        oldValues: { title: deletedTitle },
      },
      {
        module: 'FORMS',
        action: 'DELETE',
        description: `Deleted draft form "${deletedTitle}"`,
        performedBy: userId,
        entityId: id,
      },
    );
  }

  async publishForm(
    id: string,
    request: PublishDto,
    userId: string,
  ): Promise<FormDetailResponse> {
    const form = await this.formRepository.findOne({ where: { id } });

    if (!form) {
      throw new AppException(
        'Form not found',
        HttpStatus.NOT_FOUND,
        'FORM_NOT_FOUND',
      );
    }

    if (form.status !== 'DRAFT') {
      throw new AppException(
        'Invalid status transition. Form must be in DRAFT status to publish.',
        HttpStatus.BAD_REQUEST,
        'INVALID_STATUS_TRANSITION',
      );
    }

    const questionCount = await this.questionRepository.count({
      where: { formId: id },
    });

    if (questionCount === 0) {
      throw new AppException(
        'Form must have at least one question to publish',
        HttpStatus.BAD_REQUEST,
        'FORM_HAS_NO_QUESTIONS',
      );
    }

    // Validate every state key is numeric and exists in the master view.
    // This prevents a partial publish where the status is flipped but the
    // assignment insert then fails.
    const badFormat = request.stateKeys.filter((k) => !/^\d+$/.test(String(k)));
    if (badFormat.length > 0) {
      throw new AppException(
        `Invalid state key(s): ${badFormat.join(', ')}.`,
        HttpStatus.BAD_REQUEST,
        'INVALID_STATE_KEY',
      );
    }

    const uniqueKeys = Array.from(new Set(request.stateKeys.map((k) => String(k))));
    const existingRows = await this.formRepository.manager.query(
      `SELECT state_key FROM rvsk_portal.vw_state_master WHERE state_key = ANY($1::bigint[])`,
      [uniqueKeys],
    );
    const existingKeys = new Set(existingRows.map((r: any) => String(r.state_key)));
    const unknown = uniqueKeys.filter((k) => !existingKeys.has(k));
    if (unknown.length > 0) {
      throw new AppException(
        `Unknown state key(s): ${unknown.join(', ')}.`,
        HttpStatus.BAD_REQUEST,
        'UNKNOWN_STATE_KEY',
      );
    }

    // Transition status + write assignments atomically. If assignment insert
    // fails, the status change rolls back too (no half-published form).
    const saved = await this.formRepository.manager.transaction(async (em) => {
      form.status = 'PUBLISHED';
      form.publishDate = new Date();
      form.updatedBy = userId;
      if (request.dueDate) {
        form.dueDate = new Date(request.dueDate);
      }
      const savedForm = await em.save(form);

      // Replace any existing assignments for idempotency on retry.
      await em.delete(FormAssignment, { formId: id });

      const assignments: FormAssignment[] = uniqueKeys.map((stateKey) => {
        const assignment = new FormAssignment();
        assignment.id = uuidv4();
        assignment.formId = id;
        assignment.stateKey = stateKey;
        assignment.submissionStatus = 'PENDING';
        return assignment;
      });
      await em.save(assignments);

      return savedForm;
    });

    await this.auditService.recordAndLog(
      {
        entityName: 'FORM',
        entityId: saved.id,
        actionType: 'PUBLISH',
        userId,
        newValues: {
          title: saved.title,
          status: saved.status,
          assignedStateKeys: uniqueKeys,
        },
      },
      {
        module: 'FORMS',
        action: 'PUBLISH',
        description: `Published form "${saved.title}" to ${uniqueKeys.length} state(s)`,
        performedBy: userId,
        entityId: saved.id,
      },
    );

    // RVSK-NOTIFY-EMAIL-003: FORM_PUBLISHED_TO_STATE — one per assigned state.
    await this.notifyStates(
      'FORM_PUBLISHED_TO_STATE',
      saved,
      uniqueKeys,
      'publish',
    );

    return this.toDetailResponse(saved, questionCount);
  }

  /**
   * RVSK-NOTIFY-EMAIL-003 — manual reminder (Super Admin / RVSK Admin) to every
   * state whose submission is still PENDING for a published form.
   */
  async remind(
    id: string,
  ): Promise<{ success: boolean; message: string; remindedStates: number }> {
    const form = await this.formRepository.findOne({ where: { id } });
    if (!form) {
      throw new AppException(
        'Form not found',
        HttpStatus.NOT_FOUND,
        'FORM_NOT_FOUND',
      );
    }
    if (form.status !== 'PUBLISHED') {
      throw new AppException(
        'Reminders can only be sent for a PUBLISHED form.',
        HttpStatus.BAD_REQUEST,
        'FORM_NOT_PUBLISHED',
      );
    }
    const pending = await this.assignmentRepository.find({
      where: { formId: id, submissionStatus: 'PENDING' },
    });
    const pendingKeys = pending.map((a) => String(a.stateKey));
    await this.notifyStates(
      'FORM_SUBMISSION_REMINDER',
      form,
      pendingKeys,
      `remind:${Date.now()}`,
    );
    return {
      success: true,
      message: `Reminder dispatched to ${pendingKeys.length} pending state(s).`,
      remindedStates: pendingKeys.length,
    };
  }

  async closeForm(id: string, userId: string): Promise<FormDetailResponse> {
    const form = await this.formRepository.findOne({ where: { id } });

    if (!form) {
      throw new AppException(
        'Form not found',
        HttpStatus.NOT_FOUND,
        'FORM_NOT_FOUND',
      );
    }

    if (form.status !== 'PUBLISHED') {
      throw new AppException(
        'Invalid status transition. Form must be in PUBLISHED status to close.',
        HttpStatus.BAD_REQUEST,
        'INVALID_STATUS_TRANSITION',
      );
    }

    form.status = 'CLOSED';
    form.updatedBy = userId;

    const saved = await this.formRepository.save(form);

    await this.auditService.recordAndLog(
      {
        entityName: 'FORM',
        entityId: saved.id,
        actionType: 'CLOSE',
        userId,
        newValues: { title: saved.title, status: saved.status },
      },
      {
        module: 'FORMS',
        action: 'CLOSE',
        description: `Closed form "${saved.title}"`,
        performedBy: userId,
        entityId: saved.id,
      },
    );

    const questionCount = await this.questionRepository.count({
      where: { formId: id },
    });

    return this.toDetailResponse(saved, questionCount);
  }

  private toDetailResponse(form: FormMaster, questionCount: number): FormDetailResponse {
    const response = new FormDetailResponse();
    response.id = form.id;
    response.title = form.title;
    response.description = form.description;
    response.instructions = form.instructions;
    response.status = form.status;
    response.dueDate = form.dueDate;
    response.publishDate = form.publishDate;
    response.createdBy = form.createdBy;
    response.createdDate = form.createdDate;
    response.updatedBy = form.updatedBy;
    response.updatedDate = form.updatedDate;
    response.questionCount = questionCount;
    return response;
  }

  private toListResponse(form: FormMaster, questionCount: number): FormListResponse {
    const response = new FormListResponse();
    response.id = form.id;
    response.title = form.title;
    response.status = form.status;
    response.dueDate = form.dueDate;
    response.createdDate = form.createdDate;
    response.questionCount = questionCount;
    return response;
  }
}

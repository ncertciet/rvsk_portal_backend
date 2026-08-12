import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppException, PageResponse } from '@rvsk/common';
import { FormMaster } from './entities/form-master.entity';
import { FormAssignment } from './entities/form-assignment.entity';
import { FormQuestion } from '../questions/entities/form-question.entity';
import { FormCreateDto } from './dto/form-create.dto';
import { PublishDto } from './dto/publish.dto';
import { FormDetailResponse } from './dto/form-detail-response.dto';
import { FormListResponse } from './dto/form-list-response.dto';

@Injectable()
export class FormService {
  constructor(
    @InjectRepository(FormMaster)
    private readonly formRepository: Repository<FormMaster>,
    @InjectRepository(FormAssignment)
    private readonly assignmentRepository: Repository<FormAssignment>,
    @InjectRepository(FormQuestion)
    private readonly questionRepository: Repository<FormQuestion>,
  ) {}

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

    // Delete questions first
    await this.questionRepository.delete({ formId: id });
    // Delete the form
    await this.formRepository.delete({ id });
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

    // Transition status
    form.status = 'PUBLISHED';
    form.publishDate = new Date();
    form.updatedBy = userId;

    if (request.dueDate) {
      form.dueDate = new Date(request.dueDate);
    }

    const saved = await this.formRepository.save(form);

    // Create FormAssignment records for each stateCode
    const assignments: FormAssignment[] = request.stateCodes.map((stateCode) => {
      const assignment = new FormAssignment();
      assignment.id = uuidv4();
      assignment.formId = id;
      assignment.stateCode = stateCode;
      assignment.submissionStatus = 'PENDING';
      return assignment;
    });

    await this.assignmentRepository.save(assignments);

    return this.toDetailResponse(saved, questionCount);
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

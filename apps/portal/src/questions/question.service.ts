import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppException } from '@rvsk/common';
import { FormQuestion } from './entities/form-question.entity';
import { FormMaster } from '../forms/entities/form-master.entity';
import { QuestionDto } from './dto/question.dto';

const CHOICE_FIELD_TYPES = ['DROPDOWN', 'RADIO', 'CHECKBOX'];

@Injectable()
export class FormQuestionService {
  constructor(
    @InjectRepository(FormQuestion)
    private readonly questionRepo: Repository<FormQuestion>,
    @InjectRepository(FormMaster)
    private readonly formRepo: Repository<FormMaster>,
  ) {}

  async addQuestion(formId: string, request: QuestionDto): Promise<FormQuestion> {
    const form = await this.formRepo.findOne({ where: { id: formId } });

    if (!form) {
      throw new AppException(
        'Form not found',
        HttpStatus.NOT_FOUND,
        'FORM_NOT_FOUND',
      );
    }

    if (form.status !== 'DRAFT') {
      throw new AppException(
        'Can only add questions to DRAFT forms',
        HttpStatus.BAD_REQUEST,
        'OPERATION_NOT_ALLOWED',
      );
    }

    this.validateOptionsJson(request);

    // Get next displayOrder
    const maxOrder = await this.questionRepo.maximum('displayOrder', { formId });

    const question = new FormQuestion();
    question.id = uuidv4();
    question.formId = formId;
    question.questionText = request.questionText;
    question.fieldType = request.fieldType;
    question.isRequired = !!request.isRequired;
    question.helpText = request.helpText || null;
    question.optionsJson = request.optionsJson || null;
    question.displayOrder = (maxOrder || 0) + 1;

    return this.questionRepo.save(question);
  }

  async updateQuestion(questionId: string, request: QuestionDto): Promise<FormQuestion> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });

    if (!question) {
      throw new AppException(
        'Question not found',
        HttpStatus.NOT_FOUND,
        'QUESTION_NOT_FOUND',
      );
    }

    const form = await this.formRepo.findOne({ where: { id: question.formId } });

    if (!form || form.status !== 'DRAFT') {
      throw new AppException(
        'Can only update questions on DRAFT forms',
        HttpStatus.BAD_REQUEST,
        'OPERATION_NOT_ALLOWED',
      );
    }

    this.validateOptionsJson(request);

    question.questionText = request.questionText;
    question.fieldType = request.fieldType;
    question.isRequired = !!request.isRequired;
    question.helpText = request.helpText || null;
    question.optionsJson = request.optionsJson || null;

    return this.questionRepo.save(question);
  }

  async deleteQuestion(questionId: string): Promise<void> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });

    if (!question) {
      throw new AppException(
        'Question not found',
        HttpStatus.NOT_FOUND,
        'QUESTION_NOT_FOUND',
      );
    }

    const form = await this.formRepo.findOne({ where: { id: question.formId } });

    if (!form || form.status !== 'DRAFT') {
      throw new AppException(
        'Can only delete questions on DRAFT forms',
        HttpStatus.BAD_REQUEST,
        'OPERATION_NOT_ALLOWED',
      );
    }

    await this.questionRepo.delete({ id: questionId });
  }

  async reorderQuestions(formId: string, orderedIds: string[]): Promise<void> {
    const form = await this.formRepo.findOne({ where: { id: formId } });

    if (!form) {
      throw new AppException(
        'Form not found',
        HttpStatus.NOT_FOUND,
        'FORM_NOT_FOUND',
      );
    }

    if (form.status !== 'DRAFT') {
      throw new AppException(
        'Can only reorder questions on DRAFT forms',
        HttpStatus.BAD_REQUEST,
        'OPERATION_NOT_ALLOWED',
      );
    }

    // Update displayOrder for each question to its index + 1
    const updatePromises = orderedIds.map((id, index) =>
      this.questionRepo.update({ id, formId }, { displayOrder: index + 1 }),
    );

    await Promise.all(updatePromises);
  }

  async getQuestions(formId: string): Promise<FormQuestion[]> {
    return this.questionRepo.find({
      where: { formId },
      order: { displayOrder: 'ASC' },
    });
  }

  /**
   * Validates that optionsJson is provided when fieldType requires choices
   * (DROPDOWN, RADIO, CHECKBOX).
   */
  private validateOptionsJson(request: QuestionDto): void {
    if (
      CHOICE_FIELD_TYPES.includes(request.fieldType) &&
      !request.optionsJson
    ) {
      throw new AppException(
        'optionsJson is required for DROPDOWN, RADIO, and CHECKBOX field types',
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
      );
    }
  }
}

import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppException, PageResponse } from '@rvsk/common';
import { FormResponse } from './entities/form-response.entity';
import { FormAnswer } from './entities/form-answer.entity';
import { FormQuestion } from '../questions/entities/form-question.entity';
import { FormMaster } from '../forms/entities/form-master.entity';
import { AnswerDto } from './dto/answer.dto';

@Injectable()
export class FormResponseService {
  constructor(
    @InjectRepository(FormResponse)
    private readonly responseRepository: Repository<FormResponse>,
    @InjectRepository(FormAnswer)
    private readonly answerRepository: Repository<FormAnswer>,
    @InjectRepository(FormQuestion)
    private readonly questionRepository: Repository<FormQuestion>,
    @InjectRepository(FormMaster)
    private readonly formRepository: Repository<FormMaster>,
  ) {}

  async submitResponse(
    formId: string,
    answers: AnswerDto[],
    userId: string,
    stateKey: string | null,
  ): Promise<FormResponse> {
    // Validate form exists and is PUBLISHED
    const form = await this.formRepository.findOne({ where: { id: formId } });

    if (!form) {
      throw new AppException(
        'Form not found',
        HttpStatus.NOT_FOUND,
        'FORM_NOT_FOUND',
      );
    }

    if (form.status !== 'PUBLISHED') {
      throw new AppException(
        'Form is not in PUBLISHED status. Responses can only be submitted to published forms.',
        HttpStatus.BAD_REQUEST,
        'FORM_NOT_PUBLISHED',
      );
    }

    // Get all questions for the form
    const questions = await this.questionRepository.find({
      where: { formId },
    });

    // Validate required fields have non-empty answers
    const requiredQuestions = questions.filter((q) => q.isRequired);
    const unanswered = requiredQuestions.filter((rq) => {
      const answer = answers.find((a) => a.questionId === rq.id);
      return !answer || !answer.answerText || answer.answerText.trim() === '';
    });

    if (unanswered.length > 0) {
      throw new AppException(
        `Required questions unanswered: ${unanswered.map((q) => q.questionText).join(', ')}`,
        HttpStatus.BAD_REQUEST,
        'REQUIRED_FIELDS_MISSING',
      );
    }

    // Create FormResponse record
    const response = new FormResponse();
    response.id = uuidv4();
    response.formId = formId;
    response.userId = userId;
    response.stateKey = stateKey;
    response.status = 'SUBMITTED';
    response.submittedAt = new Date();

    const savedResponse = await this.responseRepository.save(response);

    // Create FormAnswer records
    const formAnswers = answers.map((a) => {
      const answer = new FormAnswer();
      answer.id = uuidv4();
      answer.responseId = savedResponse.id;
      answer.questionId = a.questionId;
      answer.answerText = a.answerText || null;
      return answer;
    });

    await this.answerRepository.save(formAnswers);

    // Mark this state's assignment as SUBMITTED so My Forms reflects it.
    if (stateKey) {
      await this.responseRepository.manager.query(
        `UPDATE rvsk_portal.form_assignment
            SET submission_status = 'SUBMITTED'
          WHERE form_id = $1 AND state_key = $2`,
        [formId, stateKey],
      );
    }

    return savedResponse;
  }

  async getResponses(
    formId: string,
    page: number = 0,
    size: number = 20,
  ): Promise<PageResponse<FormResponse>> {
    const [content, totalElements] = await this.responseRepository.findAndCount({
      where: { formId },
      order: { submittedAt: 'DESC' },
      skip: page * size,
      take: size,
    });

    return new PageResponse(content, totalElements, page, size);
  }

  async getMyResponse(
    formId: string,
    userId: string,
  ): Promise<FormResponse | null> {
    return this.responseRepository.findOne({
      where: { formId, userId },
    });
  }
}

import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppException, PageResponse } from '@rvsk/common';
import { Logger } from '@nestjs/common';
import { FormResponse } from './entities/form-response.entity';
import { FormAnswer } from './entities/form-answer.entity';
import { FormQuestion } from '../questions/entities/form-question.entity';
import { FormMaster } from '../forms/entities/form-master.entity';
import { PortalUser } from '../auth/entities/portal-user.entity';
import { AnswerDto } from './dto/answer.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class FormResponseService {
  private readonly logger = new Logger(FormResponseService.name);

  constructor(
    @InjectRepository(FormResponse)
    private readonly responseRepository: Repository<FormResponse>,
    @InjectRepository(FormAnswer)
    private readonly answerRepository: Repository<FormAnswer>,
    @InjectRepository(FormQuestion)
    private readonly questionRepository: Repository<FormQuestion>,
    @InjectRepository(FormMaster)
    private readonly formRepository: Repository<FormMaster>,
    @InjectRepository(PortalUser)
    private readonly userRepository: Repository<PortalUser>,
    private readonly notificationService: NotificationService,
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

    // RVSK-NOTIFY-EMAIL-003: FORM_SUBMITTED_BY_STATE → form creator + RVSK admins.
    await this.notifyFormSubmitted(form, userId, stateKey, savedResponse.id);

    return savedResponse;
  }

  /**
   * Notify the form creator and RVSK admins that a state submitted a form.
   * Non-blocking; deduped per response id + recipient.
   */
  private async notifyFormSubmitted(
    form: FormMaster,
    submitterId: string,
    stateKey: string | null,
    responseId: string,
  ): Promise<void> {
    // Resolve submitting state's display name from the submitter's snapshot.
    const submitter = await this.userRepository.findOne({
      where: { id: submitterId },
    });
    const stateName = submitter?.stateName || (stateKey ? `State ${stateKey}` : 'Unknown');

    // Recipients: the form creator + all active Super/RVSK admins.
    const recipients = new Map<string, string>(); // email -> name
    if (form.createdBy) {
      const creator = await this.userRepository.findOne({
        where: { id: form.createdBy },
      });
      const cEmail = creator?.contactEmail || creator?.userEmail;
      if (cEmail) {
        recipients.set(cEmail, creator?.displayName || creator?.username || '');
      }
    }
    const admins = await this.userRepository.find({
      where: [
        { role: 'RVSK_Admin', isActive: true },
        { role: 'Super_Admin', isActive: true },
      ],
    });
    for (const a of admins) {
      const email = a.contactEmail || a.userEmail;
      if (email && !recipients.has(email)) {
        recipients.set(email, a.displayName || a.username);
      }
    }

    for (const [email] of recipients) {
      await this.notificationService.notify('FORM_SUBMITTED_BY_STATE', {
        to: email,
        referenceType: 'FORM',
        referenceId: `${responseId}:${email}`,
        data: {
          state_name: stateName,
          form_title: form.title,
          submitted_at: new Date().toISOString().slice(0, 10),
        },
      });
    }
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

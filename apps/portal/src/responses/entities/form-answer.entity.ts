import {
  Entity,
  Column,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'form_response_detail', schema: 'rvsk_portal' })
export class FormAnswer {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'response_id', type: 'uuid' })
  responseId: string;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId: string;

  @Column({ name: 'answer_value', type: 'text', nullable: true })
  answerText: string;
}

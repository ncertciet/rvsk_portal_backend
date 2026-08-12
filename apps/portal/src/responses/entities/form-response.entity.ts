import {
  Entity,
  Column,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';

@Entity({ name: 'form_response', schema: 'rvsk_portal' })
export class FormResponse {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'form_id', type: 'uuid' })
  formId: string;

  @Column({ name: 'submitted_by', type: 'uuid' })
  userId: string;

  @Column({ name: 'state_code', nullable: true, length: 2 })
  stateCode: string;

  @Column({ name: 'status', nullable: false, length: 20, default: 'SUBMITTED' })
  status: string;

  @Column({ name: 'submitted_date', type: 'timestamptz', nullable: true })
  submittedAt: Date;

  @BeforeInsert()
  setSubmittedAt() {
    this.submittedAt = new Date();
  }
}

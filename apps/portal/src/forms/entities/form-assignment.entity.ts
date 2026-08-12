import {
  Entity,
  Column,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';

@Entity({ name: 'form_assignment', schema: 'rvsk_portal' })
export class FormAssignment {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'form_id', type: 'uuid' })
  formId: string;

  @Column({ name: 'state_code', nullable: false, length: 2 })
  stateCode: string;

  @Column({ name: 'submission_status', nullable: false, length: 20, default: 'PENDING' })
  submissionStatus: string;

  @Column({ name: 'assigned_date', type: 'timestamptz' })
  assignedAt: Date;

  @BeforeInsert()
  setAssignedAt() {
    this.assignedAt = new Date();
  }
}

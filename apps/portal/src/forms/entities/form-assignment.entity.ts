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

  // Geographic scope key (bigint). Maps to portal_users.state_key /
  // vw_state_master.state_key. pg returns bigint as a JS string.
  @Column({ name: 'state_key', type: 'bigint', nullable: false })
  stateKey: string;

  @Column({ name: 'submission_status', nullable: false, length: 20, default: 'PENDING' })
  submissionStatus: string;

  @Column({ name: 'assigned_date', type: 'timestamptz' })
  assignedAt: Date;

  @BeforeInsert()
  setAssignedAt() {
    this.assignedAt = new Date();
  }
}

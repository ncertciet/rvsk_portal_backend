import {
  Entity,
  Column,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';

@Entity({ name: 'grievance_history', schema: 'rvsk_portal' })
export class GrievanceHistory {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
  })
  id: string;

  @Column({
    name: 'grievance_id',
    nullable: false,
    type: 'uuid',
  })
  grievanceId: string;

  @Column({ name: 'action', nullable: false, length: 100 })
  action: string;

  @Column({ name: 'old_status', nullable: true, length: 30 })
  oldStatus: string;

  @Column({ name: 'new_status', nullable: true, length: 30 })
  newStatus: string;

  @Column({ name: 'comments', type: 'text', nullable: true })
  comment: string;

  @Column({ name: 'is_internal', type: 'boolean', default: false })
  isInternal: boolean;

  @Column({
    name: 'performed_by',
    nullable: false,
    type: 'uuid',
  })
  performedBy: string;

  @Column({ name: 'performed_at', type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
  }
}

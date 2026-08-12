import {
  Entity,
  Column,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';

@Entity({ name: 'grievance_responses', schema: 'rvsk_portal' })
export class GrievanceResponse {
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

  @Column({ name: 'response_text', type: 'text', nullable: false })
  responseText: string;

  @Column({
    name: 'responded_by',
    nullable: false,
    type: 'uuid',
  })
  respondedBy: string;

  @Column({ name: 'responded_at', type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
  }
}

import {
  Entity,
  Column,
  PrimaryColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

@Entity({ name: 'grievances', schema: 'rvsk_portal' })
export class Grievance {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
  })
  id: string;

  @Column({ name: 'grievance_id', unique: true, nullable: false, length: 50 })
  grievanceId: string;

  @Column({
    name: 'created_by',
    nullable: false,
    type: 'uuid',
  })
  createdBy: string;

  @Column({ name: 'state_code', nullable: true, length: 2 })
  stateCode: string | null = null;

  @Column({ name: 'district_code', nullable: true, length: 10 })
  districtCode: string | null = null;

  @Column({
    name: 'assigned_to',
    nullable: true,
    type: 'uuid',
  })
  assignedTo: string | null = null;

  @Column({ name: 'category', nullable: false, length: 50 })
  category: string;

  @Column({ name: 'sub_category', nullable: true, length: 50 })
  subCategory: string | null = null;

  @Column({ name: 'subject', nullable: false, length: 200 })
  subject: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null = null;

  @Column({ name: 'status', nullable: false, length: 30, default: "'OPEN'" })
  status: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'resolved_at', nullable: true, type: 'timestamptz' })
  resolvedAt: Date | null = null;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  setUpdatedAt() {
    this.updatedAt = new Date();
  }
}

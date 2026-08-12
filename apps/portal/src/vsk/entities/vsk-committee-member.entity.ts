import {
  Entity,
  PrimaryColumn,
  Column,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity({ name: 'vsk_committee_member', schema: 'rvsk_portal' })
export class VskCommitteeMember {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'state_code', nullable: false, length: 2 })
  stateCode: string;

  @Column({ name: 'name', nullable: false, length: 200 })
  name: string;

  @Column({ name: 'designation', nullable: true, length: 200 })
  designation: string;

  @Column({ name: 'phone', nullable: true, length: 15 })
  phone: string;

  @Column({ name: 'whatsapp', nullable: true, length: 15 })
  whatsapp: string;

  @Column({ name: 'email', nullable: true, length: 200 })
  email: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: true, default: true })
  isActive: boolean;

  @Column({ name: 'created_by', nullable: true, type: 'uuid' })
  createdBy: string;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date;

  @Column({ name: 'updated_by', nullable: true, type: 'uuid' })
  updatedBy: string;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date;

  @BeforeInsert()
  setDefaults() {
    if (!this.id) {
      this.id = uuidv4();
    }
    if (this.isActive == null) this.isActive = true;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  setUpdatedAt() {
    this.updatedAt = new Date();
  }
}

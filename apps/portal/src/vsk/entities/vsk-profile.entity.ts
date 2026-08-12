import {
  Entity,
  PrimaryColumn,
  Column,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity({ name: 'vsk_profile', schema: 'rvsk_portal' })
export class VskProfile {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'state_code', nullable: false, unique: true, length: 2 })
  stateCode: string;

  // Address
  @Column({ name: 'address_line1', nullable: true, length: 500 })
  addressLine1: string;

  @Column({ name: 'address_line2', nullable: true, length: 500 })
  addressLine2: string;

  @Column({ name: 'city', nullable: true, length: 200 })
  city: string;

  @Column({ name: 'pincode', nullable: true, length: 10 })
  pincode: string;

  // Scheme
  @Column({ name: 'facilitated_by', nullable: true, length: 200 })
  facilitatedBy: string;

  @Column({ name: 'other_scheme_name', nullable: true, length: 200 })
  otherSchemeName: string;

  // Step Status Tracking
  @Column({ name: 'step1_status', nullable: true, length: 20, default: "'PENDING'" })
  step1Status: string;

  @Column({ name: 'step2_status', nullable: true, length: 20, default: "'PENDING'" })
  step2Status: string;

  @Column({ name: 'step3_status', nullable: true, length: 20, default: "'PENDING'" })
  step3Status: string;

  @Column({ name: 'step4_status', nullable: true, length: 20, default: "'PENDING'" })
  step4Status: string;

  // Submission
  @Column({ name: 'submission_status', nullable: true, length: 20, default: "'DRAFT'" })
  submissionStatus: string;

  @Column({ name: 'declaration_certified', type: 'boolean', nullable: true, default: false })
  declarationCertified: boolean;

  // Audit
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
    if (!this.step1Status) this.step1Status = 'PENDING';
    if (!this.step2Status) this.step2Status = 'PENDING';
    if (!this.step3Status) this.step3Status = 'PENDING';
    if (!this.step4Status) this.step4Status = 'PENDING';
    if (!this.submissionStatus) this.submissionStatus = 'DRAFT';
    if (this.declarationCertified == null) this.declarationCertified = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  setUpdatedAt() {
    this.updatedAt = new Date();
  }
}

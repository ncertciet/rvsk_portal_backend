import {
  Entity,
  PrimaryColumn,
  Column,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

@Entity({ name: 'portal_users', schema: 'rvsk_portal' })
export class PortalUser {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'username', unique: true, nullable: false, length: 255 })
  username: string;

  @Column({ name: 'display_name', nullable: true, length: 255 })
  displayName: string;

  @Column({ name: 'password_hash', nullable: true, length: 255 })
  passwordHash: string;

  @Column({ name: 'role', nullable: false, length: 50 })
  role: string;

  @Column({ name: 'state_code', nullable: true, length: 2 })
  stateCode: string;

  @Column({ name: 'district_code', nullable: true, length: 10 })
  districtCode: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @Column({ name: 'is_first_login', type: 'boolean', default: true })
  isFirstLogin: boolean;

  @Column({ name: 'phone', nullable: true, length: 15 })
  phone: string;

  @Column({ name: 'designation', nullable: true, length: 100 })
  designation: string;

  @Column({ name: 'department', nullable: true, length: 100 })
  department: string;

  @Column({ name: 'user_email', nullable: true, length: 255 })
  userEmail: string;

  @Column({ name: 'contact_email', nullable: true, length: 255 })
  contactEmail: string;

  @Column({ name: 'mobile_number', nullable: true, length: 15 })
  mobileNumber: string;

  @Column({ name: 'password_changed_at', nullable: true, type: 'timestamptz' })
  passwordChangedAt: Date;

  @Column({ name: 'created_by', nullable: true, type: 'uuid' })
  createdBy: string;

  @Column({ name: 'failed_attempts', default: 0 })
  failedAttempts: number;

  @Column({ name: 'locked_until', nullable: true, type: 'timestamptz' })
  lockedUntil: Date;

  @Column({ name: 'last_login_at', nullable: true, type: 'timestamptz' })
  lastLoginAt: Date;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

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

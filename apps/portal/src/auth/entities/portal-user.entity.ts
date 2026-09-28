import {
  Entity,
  PrimaryColumn,
  Column,
  BeforeInsert,
  BeforeUpdate,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PortalRole } from '../../roles/entities/portal-role.entity';

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

  // RVSK-RBAC-ROLE-002-A (Phase 4) — the legacy `role` VARCHAR column has been
  // dropped. `role_id` (FK) is now the single source of truth; `role` is a
  // read-only accessor that resolves `role_code` from the eagerly-loaded
  // portal_role master, so all existing `user.role` reads keep working and the
  // JWT claim still carries the role_code string. Authorization is unchanged.
  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId: string | null;

  @ManyToOne(() => PortalRole, { eager: true })
  @JoinColumn({ name: 'role_id' })
  rolePortal?: PortalRole | null;

  /** Backward-compatible accessor: the stable role_code authorization key. */
  get role(): string {
    return this.rolePortal?.roleCode ?? '';
  }

  // ── Geographic scope (view-sourced keys + denormalized name snapshots) ──
  // *_key columns are bigint (PostgreSQL). The pg driver returns bigint as a
  // JS string to avoid precision loss, so these are typed as `string`.
  // Keys are authoritative; names are display snapshots populated from the
  // rvsk_portal.vw_*_master views at write time.

  @Column({ name: 'state_key', type: 'bigint', nullable: true })
  stateKey: string | null;

  @Column({ name: 'state_name', nullable: true, length: 150 })
  stateName: string | null;

  @Column({ name: 'district_key', type: 'bigint', nullable: true })
  districtKey: string | null;

  @Column({ name: 'district_name', nullable: true, length: 150 })
  districtName: string | null;

  @Column({ name: 'block_key', type: 'bigint', nullable: true })
  blockKey: string | null;

  @Column({ name: 'block_name', nullable: true, length: 150 })
  blockName: string | null;

  // Reserved for future use (cluster/school-level users not created yet).
  @Column({ name: 'cluster_key', type: 'bigint', nullable: true })
  clusterKey: string | null;

  @Column({ name: 'cluster_name', nullable: true, length: 150 })
  clusterName: string | null;

  @Column({ name: 'udise_code', nullable: true, length: 20 })
  udiseCode: string | null;

  @Column({ name: 'school_name', nullable: true, length: 255 })
  schoolName: string | null;

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

import {
  Entity,
  Column,
  PrimaryColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

/**
 * State → SPOC assignment mapping (RVSK-GRV-SPOC-003).
 *
 * Source of truth for grievance ownership: a grievance belongs to a State
 * (state_key); a State belongs to exactly ONE active SPOC; a SPOC may own many
 * States. Historical rows are retained (is_active = false) as the audit trail.
 *
 * A partial unique index (state_key WHERE is_active) guarantees at most one
 * active SPOC per State.
 */
@Entity({ name: 'state_spoc_mapping', schema: 'rvsk_portal' })
export class StateSpocMapping {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  // bigint → JS string via pg driver (matches portal_users.state_key convention).
  @Column({ name: 'state_key', type: 'bigint' })
  stateKey: string;

  @Column({ name: 'spoc_user_id', type: 'uuid' })
  spocUserId: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt: Date;

  @Column({ name: 'assigned_by', type: 'uuid' })
  assignedBy: string;

  @Column({ name: 'unassigned_at', type: 'timestamptz', nullable: true })
  unassignedAt: Date | null = null;

  @Column({ name: 'unassigned_by', type: 'uuid', nullable: true })
  unassignedBy: string | null = null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null = null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  setCreatedAt() {
    const now = new Date();
    this.createdAt = now;
    this.updatedAt = now;
    if (!this.assignedAt) {
      this.assignedAt = now;
    }
  }

  @BeforeUpdate()
  setUpdatedAt() {
    this.updatedAt = new Date();
  }
}

import { Entity, Column, PrimaryColumn, BeforeInsert } from 'typeorm';

/**
 * General audit trail — maps to the existing `rvsk_portal.vsk_audit_log` table.
 *
 * Captures who changed what, on which entity, and the before/after values.
 * This is the forensic/compliance record (as opposed to the curated dashboard
 * feed in `activity_log`). Rows are insert-only.
 */
@Entity({ name: 'vsk_audit_log', schema: 'rvsk_portal' })
export class AuditLog {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  /** Logical entity/table the action was performed on, e.g. 'USER', 'FORM'. */
  @Column({ name: 'entity_name', nullable: false, length: 100 })
  entityName: string;

  /** Primary key of the affected entity (UUID as string). */
  @Column({ name: 'entity_id', type: 'uuid', nullable: false })
  entityId: string;

  /** CREATE | UPDATE | DELETE | <domain action e.g. PUBLISH, ASSIGN>. */
  @Column({ name: 'action_type', nullable: false, length: 20 })
  actionType: string;

  /** JSON snapshot of the entity (or changed fields) before the action. */
  @Column({ name: 'old_values', type: 'text', nullable: true })
  oldValues: string | null;

  /** JSON snapshot of the entity (or changed fields) after the action. */
  @Column({ name: 'new_values', type: 'text', nullable: true })
  newValues: string | null;

  /** Acting user id. Nullable to tolerate system-initiated changes. */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'user_name', nullable: true, length: 200 })
  userName: string | null;

  @Column({ name: 'user_state_code', nullable: true, length: 2 })
  userStateCode: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
  }
}

import { Entity, Column, PrimaryColumn, BeforeInsert } from 'typeorm';

/**
 * Dashboard activity feed — maps to the existing `rvsk_portal.activity_log`
 * table. A curated, human-readable subset of activity surfaced on the
 * Super Admin / RVSK Admin home page "Recent Activity" list.
 */
@Entity({ name: 'activity_log', schema: 'rvsk_portal' })
export class ActivityLogEntry {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  /** Module bucket: USERS | FORMS | GRIEVANCES | VSK. */
  @Column({ name: 'module', nullable: false, length: 50 })
  module: string;

  /** Short action verb: CREATE | PUBLISH | ASSIGN | RESOLVE ... */
  @Column({ name: 'action', nullable: false, length: 100 })
  action: string;

  /** Human-readable sentence shown in the feed. */
  @Column({ name: 'description', nullable: true, length: 500 })
  description: string | null;

  /** Affected entity id (stored as text; feed does not join back). */
  @Column({ name: 'entity_id', nullable: true, length: 100 })
  entityId: string | null;

  /** Acting user id (FK to portal_users; NOT NULL in schema). */
  @Column({ name: 'performed_by', type: 'uuid', nullable: false })
  performedBy: string;

  @Column({ name: 'performed_at', type: 'timestamptz' })
  performedAt: Date;

  @Column({ name: 'state_code', nullable: true, length: 10 })
  stateCode: string | null;

  @BeforeInsert()
  setPerformedAt() {
    this.performedAt = new Date();
  }
}

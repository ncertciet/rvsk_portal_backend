import { Entity, PrimaryColumn, Column, BeforeInsert } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * RVSK-NOTIFY-EMAIL-003 — config change trail (who changed what field, when).
 */
@Entity({ name: 'notification_config_audit', schema: 'rvsk_portal' })
export class NotificationConfigAudit {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'event_code', length: 60 })
  eventCode: string;

  @Column({ name: 'field_changed', length: 60, nullable: true })
  fieldChanged: string | null;

  @Column({ name: 'previous_value', type: 'text', nullable: true })
  previousValue: string | null;

  @Column({ name: 'new_value', type: 'text', nullable: true })
  newValue: string | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @Column({ name: 'changed_at', type: 'timestamptz' })
  changedAt: Date;

  @BeforeInsert()
  setDefaults() {
    if (!this.id) {
      this.id = uuidv4();
    }
    if (!this.changedAt) {
      this.changedAt = new Date();
    }
  }
}

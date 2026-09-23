import { Entity, PrimaryColumn, Column, BeforeInsert } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * RVSK-NOTIFY-EMAIL-003 — one row per configurable notification event.
 *
 * `body_template` holds only the event-specific inner content; the shared
 * branded layout (EmailLayout) wraps it at render time. `default_subject`/
 * `default_body` preserve the factory template for reset-to-default.
 */
@Entity({ name: 'notification_config', schema: 'rvsk_portal' })
export class NotificationConfig {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'event_code', length: 60, unique: true })
  eventCode: string;

  @Column({ name: 'event_name', length: 120 })
  eventName: string;

  @Column({ name: 'description', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'email_enabled', type: 'boolean', default: false })
  emailEnabled: boolean;

  @Column({ name: 'recipient_type', length: 20, default: 'USER' })
  recipientType: string; // USER | SPOC | ROLE | CUSTOM | STATE

  @Column({ name: 'recipient_value', length: 255, nullable: true })
  recipientValue: string | null;

  @Column({ name: 'cc', length: 500, nullable: true })
  cc: string | null;

  @Column({ name: 'bcc', length: 500, nullable: true })
  bcc: string | null;

  @Column({ name: 'subject_template', type: 'text', nullable: true })
  subjectTemplate: string | null;

  @Column({ name: 'body_template', type: 'text', nullable: true })
  bodyTemplate: string | null;

  @Column({ name: 'text_template', type: 'text', nullable: true })
  textTemplate: string | null;

  @Column({ name: 'default_subject', type: 'text' })
  defaultSubject: string;

  @Column({ name: 'default_body', type: 'text' })
  defaultBody: string;

  @Column({ name: 'allowed_tokens', type: 'text', nullable: true })
  allowedTokens: string | null; // CSV of token names valid for this event

  @Column({ name: 'is_customized', type: 'boolean', default: false })
  isCustomized: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @BeforeInsert()
  setDefaults() {
    if (!this.id) {
      this.id = uuidv4();
    }
    const now = new Date();
    if (!this.createdAt) {
      this.createdAt = now;
    }
    if (!this.updatedAt) {
      this.updatedAt = now;
    }
  }
}

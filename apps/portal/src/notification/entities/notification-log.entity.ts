import { Entity, PrimaryColumn, Column, BeforeInsert } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * RVSK-NOTIFY-EMAIL-003 — one row per send attempt. SMTP credentials are never
 * stored here. `dedupe_key` guards duplicate sends on retry/resend.
 */
@Entity({ name: 'notification_log', schema: 'rvsk_portal' })
export class NotificationLog {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'event_code', length: 60 })
  eventCode: string;

  @Column({ name: 'recipient_email', length: 255, nullable: true })
  recipientEmail: string | null;

  @Column({ name: 'cc', length: 500, nullable: true })
  cc: string | null;

  @Column({ name: 'subject', length: 255, nullable: true })
  subject: string | null;

  @Column({ name: 'status', length: 12 })
  status: string; // SENT | FAILED | PENDING

  @Column({ name: 'reference_type', length: 30, nullable: true })
  referenceType: string | null;

  @Column({ name: 'reference_id', length: 64, nullable: true })
  referenceId: string | null;

  @Column({ name: 'dedupe_key', length: 200, nullable: true })
  dedupeKey: string | null;

  @Column({ name: 'attempts', type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'is_test', type: 'boolean', default: false })
  isTest: boolean;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'last_attempt_at', type: 'timestamptz', nullable: true })
  lastAttemptAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @BeforeInsert()
  setDefaults() {
    if (!this.id) {
      this.id = uuidv4();
    }
    if (!this.createdAt) {
      this.createdAt = new Date();
    }
  }
}

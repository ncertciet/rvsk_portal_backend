import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-NOTIFY-EMAIL-003 — notification_log + notification_config_audit.
 *
 * notification_log: one row per send attempt (SENT/FAILED/PENDING) with retry
 * accounting and a dedupe key. SMTP credentials are never stored here.
 * notification_config_audit: config change trail (who changed what, when).
 */
export class CreateNotificationLog1758700100000 implements MigrationInterface {
  name = 'CreateNotificationLog1758700100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';
    const log = `${schema}.notification_log`;
    const audit = `${schema}.notification_config_audit`;

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${log} (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_code      VARCHAR(60) NOT NULL,
        recipient_email VARCHAR(255),
        cc              VARCHAR(500),
        subject         VARCHAR(255),
        status          VARCHAR(12) NOT NULL,
        reference_type  VARCHAR(30),
        reference_id    VARCHAR(64),
        dedupe_key      VARCHAR(200),
        attempts        INT NOT NULL DEFAULT 0,
        retry_count     INT NOT NULL DEFAULT 0,
        is_test         BOOLEAN NOT NULL DEFAULT FALSE,
        error_message   TEXT,
        last_attempt_at TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_at         TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notif_log_event ON ${log}(event_code)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notif_log_status ON ${log}(status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notif_log_dedupe ON ${log}(dedupe_key)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${audit} (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_code     VARCHAR(60) NOT NULL,
        field_changed  VARCHAR(60),
        previous_value TEXT,
        new_value      TEXT,
        changed_by     UUID,
        changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notif_audit_event ON ${audit}(event_code)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';
    await queryRunner.query(
      `DROP TABLE IF EXISTS ${schema}.notification_config_audit`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}.notification_log`);
  }
}

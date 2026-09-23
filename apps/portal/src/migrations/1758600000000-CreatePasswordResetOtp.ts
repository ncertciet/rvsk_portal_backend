import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-AUTH-PWDRESET-004 — Forgot Password (OTP-based Self-Service Recovery).
 *
 * Creates rvsk_portal.password_reset_otp which stores ONLY hashes of the OTP
 * and the post-verify reset session token (plaintext is never persisted).
 * All expiry / single-use / cooldown / attempt-cap / ownership checks are
 * enforced server-side against this table.
 */
export class CreatePasswordResetOtp1758600000000 implements MigrationInterface {
  name = 'CreatePasswordResetOtp1758600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';
    const table = `${schema}.password_reset_otp`;

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id                UUID NOT NULL,
        email                  VARCHAR(255) NOT NULL,
        otp_hash               VARCHAR(255) NOT NULL,
        expires_at             TIMESTAMPTZ NOT NULL,
        attempts               INT NOT NULL DEFAULT 0,
        max_attempts           INT NOT NULL DEFAULT 5,
        verified_at            TIMESTAMPTZ,
        consumed_at            TIMESTAMPTZ,
        reset_token_hash       VARCHAR(255),
        reset_token_expires_at TIMESTAMPTZ,
        last_sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        invalidated            BOOLEAN NOT NULL DEFAULT FALSE,
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_pwd_otp_user ON ${table}(user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_pwd_otp_email ON ${table}(email)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_pwd_otp_active ON ${table}(user_id, invalidated, consumed_at)`,
    );
    // Fast lookup of the OTP row that owns a given reset-session token.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_pwd_otp_reset_token ON ${table}(reset_token_hash)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';
    const table = `${schema}.password_reset_otp`;

    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}.idx_pwd_otp_reset_token`);
    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}.idx_pwd_otp_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}.idx_pwd_otp_email`);
    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}.idx_pwd_otp_user`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-USR-MGMT-001 (Forms alignment) — Migrate the Forms feature from the
 * legacy 2-char state_code to the bigint state_key used by portal_users.
 *
 * - form_assignment: add state_key (bigint), backfill from state_code via
 *   vw_state_master (state_id -> state_key), then drop state_code.
 * - form_response: same (table is expected empty, but handled generically).
 *
 * All existing state_code values were verified to map to a state_key.
 */
export class FormsStateKey1758500000000 implements MigrationInterface {
  name = 'FormsStateKey1758500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';

    // ── form_assignment ──
    await queryRunner.query(
      `ALTER TABLE ${schema}.form_assignment ADD COLUMN IF NOT EXISTS state_key BIGINT`,
    );
    if (await this.columnExists(queryRunner, schema, 'form_assignment', 'state_code')) {
      await queryRunner.query(`
        UPDATE ${schema}.form_assignment a
        SET state_key = s.state_key
        FROM ${schema}.vw_state_master s
        WHERE s.state_id = a.state_code
      `);
      await queryRunner.query(
        `ALTER TABLE ${schema}.form_assignment DROP COLUMN IF EXISTS state_code`,
      );
    }
    // Enforce NOT NULL to match the entity (safe: all rows backfilled).
    await queryRunner.query(
      `ALTER TABLE ${schema}.form_assignment ALTER COLUMN state_key SET NOT NULL`,
    );

    // ── form_response ──
    await queryRunner.query(
      `ALTER TABLE ${schema}.form_response ADD COLUMN IF NOT EXISTS state_key BIGINT`,
    );
    if (await this.columnExists(queryRunner, schema, 'form_response', 'state_code')) {
      await queryRunner.query(`
        UPDATE ${schema}.form_response r
        SET state_key = s.state_key
        FROM ${schema}.vw_state_master s
        WHERE s.state_id = r.state_code
      `);
      await queryRunner.query(
        `ALTER TABLE ${schema}.form_response DROP COLUMN IF EXISTS state_code`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';

    // form_assignment: recreate state_code, backfill from state_key.
    await queryRunner.query(
      `ALTER TABLE ${schema}.form_assignment ADD COLUMN IF NOT EXISTS state_code VARCHAR(2)`,
    );
    await queryRunner.query(`
      UPDATE ${schema}.form_assignment a
      SET state_code = s.state_id
      FROM ${schema}.vw_state_master s
      WHERE s.state_key = a.state_key
    `);
    await queryRunner.query(
      `ALTER TABLE ${schema}.form_assignment DROP COLUMN IF EXISTS state_key`,
    );

    // form_response
    await queryRunner.query(
      `ALTER TABLE ${schema}.form_response ADD COLUMN IF NOT EXISTS state_code VARCHAR(2)`,
    );
    await queryRunner.query(`
      UPDATE ${schema}.form_response r
      SET state_code = s.state_id
      FROM ${schema}.vw_state_master s
      WHERE s.state_key = r.state_key
    `);
    await queryRunner.query(
      `ALTER TABLE ${schema}.form_response DROP COLUMN IF EXISTS state_key`,
    );
  }

  private async columnExists(
    queryRunner: QueryRunner,
    schema: string,
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
      [schema, tableName, columnName],
    );
    return Array.isArray(rows) && rows.length > 0;
  }
}

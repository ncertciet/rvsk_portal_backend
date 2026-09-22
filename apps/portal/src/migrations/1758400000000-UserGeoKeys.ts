import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-USR-MGMT-001.7 / .8 — Replace legacy geo *_code columns on
 * portal_users with view-sourced *_key (bigint) + *_name (varchar) columns.
 *
 * - Adds: state_key/state_name, district_key/district_name,
 *   block_key/block_name, cluster_key/cluster_name, udise_code/school_name.
 * - Backfills state_key/state_name from rvsk_portal.vw_state_master by
 *   matching the legacy 2-char state_code against vw_state_master.state_id
 *   (state_id is unique, so this is unambiguous).
 * - district_key/block_key are intentionally left NULL: the legacy
 *   district_code maps ambiguously to multiple district_key values and some
 *   rows hold placeholder/junk values. District/Block admins re-select their
 *   scope via the new cascading dropdowns on next edit.
 * - Drops legacy state_code / district_code columns.
 */
export class UserGeoKeys1758400000000 implements MigrationInterface {
  name = 'UserGeoKeys1758400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';
    const table = `${schema}.portal_users`;

    // 1. Add new nullable columns (additive first, so backfill can run).
    await queryRunner.query(`
      ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS state_key    BIGINT,
        ADD COLUMN IF NOT EXISTS state_name   VARCHAR(150),
        ADD COLUMN IF NOT EXISTS district_key BIGINT,
        ADD COLUMN IF NOT EXISTS district_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS block_key    BIGINT,
        ADD COLUMN IF NOT EXISTS block_name   VARCHAR(150),
        ADD COLUMN IF NOT EXISTS cluster_key  BIGINT,
        ADD COLUMN IF NOT EXISTS cluster_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS udise_code   VARCHAR(20),
        ADD COLUMN IF NOT EXISTS school_name  VARCHAR(255)
    `);

    // 2. Backfill state_key + state_name from vw_state_master via state_id.
    //    Only runs when the legacy state_code column still exists.
    const hasStateCode = await this.columnExists(
      queryRunner,
      schema,
      'portal_users',
      'state_code',
    );

    if (hasStateCode) {
      await queryRunner.query(`
        UPDATE ${table} u
        SET state_key = s.state_key,
            state_name = s.state_name
        FROM ${schema}.vw_state_master s
        WHERE u.state_code IS NOT NULL
          AND u.state_code <> ''
          AND s.state_id = u.state_code
      `);
    }

    // 3. Drop legacy geo code columns (data preserved as state_key above).
    await queryRunner.query(`
      ALTER TABLE ${table}
        DROP COLUMN IF EXISTS state_code,
        DROP COLUMN IF EXISTS district_code
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';
    const table = `${schema}.portal_users`;

    // Recreate legacy columns.
    await queryRunner.query(`
      ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS state_code    CHAR(2),
        ADD COLUMN IF NOT EXISTS district_code VARCHAR(10)
    `);

    // Best-effort restore of state_code from state_key via the view.
    await queryRunner.query(`
      UPDATE ${table} u
      SET state_code = s.state_id
      FROM ${schema}.vw_state_master s
      WHERE u.state_key IS NOT NULL
        AND s.state_key = u.state_key
    `);

    // Drop the new columns.
    await queryRunner.query(`
      ALTER TABLE ${table}
        DROP COLUMN IF EXISTS state_key,
        DROP COLUMN IF EXISTS state_name,
        DROP COLUMN IF EXISTS district_key,
        DROP COLUMN IF EXISTS district_name,
        DROP COLUMN IF EXISTS block_key,
        DROP COLUMN IF EXISTS block_name,
        DROP COLUMN IF EXISTS cluster_key,
        DROP COLUMN IF EXISTS cluster_name,
        DROP COLUMN IF EXISTS udise_code,
        DROP COLUMN IF EXISTS school_name
    `);
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

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migrates rvsk_portal.grievances from the legacy 2-char state_code / short
 * district_code to the authoritative bigint state_key / district_key (matching
 * portal_users + rvsk_portal.vw_*_master).
 *
 * Adds the key columns, backfills them from the legacy codes via the master
 * views, swaps the indexes, and drops the legacy columns. Idempotent guards
 * make it safe against databases that were already partially migrated.
 *
 * NOTE: this must run BEFORE 1758800000000-CreateStateSpocMapping (that seed
 * reads portal_users.state_key, and the grievance ownership model relies on
 * grievances.state_key existing).
 */
export class GrievanceStateKey1758750000000 implements MigrationInterface {
  name = 'GrievanceStateKey1758750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Add the new key columns (nullable) if they do not already exist.
    await queryRunner.query(`
      ALTER TABLE rvsk_portal.grievances
        ADD COLUMN IF NOT EXISTS state_key    BIGINT,
        ADD COLUMN IF NOT EXISTS district_key BIGINT
    `);

    // Only backfill from the legacy columns if they still exist (a fresh DB
    // built from the updated init script already has the key columns and no
    // legacy columns — in that case backfill is a no-op).
    await queryRunner.query(`
      DO $$
      BEGIN
        -- 2) Backfill state_key from the legacy 2-char state_code
        --    (vw_state_master.state_id holds the legacy 2-char code).
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'rvsk_portal'
             AND table_name   = 'grievances'
             AND column_name  = 'state_code'
        ) THEN
          UPDATE rvsk_portal.grievances g
             SET state_key = sm.state_key
            FROM rvsk_portal.vw_state_master sm
           WHERE g.state_key IS NULL
             AND g.state_code IS NOT NULL
             AND sm.state_id = g.state_code;
        END IF;

        -- 3) Backfill district_key from the legacy district_code where a
        --    matching district exists (only if both the legacy column and the
        --    view's district_id column are present). Unresolvable rows stay NULL.
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'rvsk_portal'
             AND table_name   = 'grievances'
             AND column_name  = 'district_code'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'rvsk_portal'
             AND table_name   = 'vw_district_master'
             AND column_name  = 'district_id'
        ) THEN
          UPDATE rvsk_portal.grievances g
             SET district_key = dm.district_key
            FROM rvsk_portal.vw_district_master dm
           WHERE g.district_key IS NULL
             AND g.district_code IS NOT NULL
             AND dm.district_id = g.district_code;
        END IF;
      END $$;
    `);

    // 4) Refresh indexes: drop the legacy state_code index, add key indexes.
    await queryRunner.query(
      `DROP INDEX IF EXISTS rvsk_portal.idx_grv_state_code`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_grv_state_key ON rvsk_portal.grievances(state_key)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_grv_district_key ON rvsk_portal.grievances(district_key)`,
    );

    // 5) Drop the legacy columns.
    await queryRunner.query(`
      ALTER TABLE rvsk_portal.grievances
        DROP COLUMN IF EXISTS state_code,
        DROP COLUMN IF EXISTS district_code
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-create the legacy columns + index (best-effort reversal). Data in the
    // dropped columns cannot be restored; re-populate from the keys via the
    // master views.
    await queryRunner.query(`
      ALTER TABLE rvsk_portal.grievances
        ADD COLUMN IF NOT EXISTS state_code    VARCHAR(2),
        ADD COLUMN IF NOT EXISTS district_code VARCHAR(10)
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        -- Restore legacy state_code from state_key.
        UPDATE rvsk_portal.grievances g
           SET state_code = sm.state_id
          FROM rvsk_portal.vw_state_master sm
         WHERE g.state_code IS NULL
           AND g.state_key IS NOT NULL
           AND sm.state_key = g.state_key;

        -- Restore legacy district_code from district_key (if the view exposes district_id).
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'rvsk_portal'
             AND table_name   = 'vw_district_master'
             AND column_name  = 'district_id'
        ) THEN
          UPDATE rvsk_portal.grievances g
             SET district_code = dm.district_id
            FROM rvsk_portal.vw_district_master dm
           WHERE g.district_code IS NULL
             AND g.district_key IS NOT NULL
             AND dm.district_key = g.district_key;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS rvsk_portal.idx_grv_district_key`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS rvsk_portal.idx_grv_state_key`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_grv_state_code ON rvsk_portal.grievances(state_code)`,
    );

    await queryRunner.query(`
      ALTER TABLE rvsk_portal.grievances
        DROP COLUMN IF EXISTS state_key,
        DROP COLUMN IF EXISTS district_key
    `);
  }
}

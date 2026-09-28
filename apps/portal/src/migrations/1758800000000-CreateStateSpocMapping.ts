import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-GRV-SPOC-003 — State–SPOC Assignment.
 *
 * Creates rvsk_portal.state_spoc_mapping (the source of truth for grievance
 * ownership), enforces at most one active SPOC per state via a partial unique
 * index, and seeds one active mapping per current active RVSK_SPOC user's
 * state_key (preserving today's behaviour on day one).
 */
export class CreateStateSpocMapping1758800000000 implements MigrationInterface {
  name = 'CreateStateSpocMapping1758800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rvsk_portal.state_spoc_mapping (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        state_key      BIGINT NOT NULL,
        spoc_user_id   UUID NOT NULL REFERENCES rvsk_portal.portal_users(id),
        is_active      BOOLEAN NOT NULL DEFAULT TRUE,
        assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        assigned_by    UUID NOT NULL,
        unassigned_at  TIMESTAMPTZ,
        unassigned_by  UUID,
        note           TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // At most one ACTIVE SPOC per state.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ssm_active_state
        ON rvsk_portal.state_spoc_mapping (state_key)
        WHERE is_active
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ssm_spoc_active
        ON rvsk_portal.state_spoc_mapping (spoc_user_id)
        WHERE is_active
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ssm_state
        ON rvsk_portal.state_spoc_mapping (state_key)
    `);

    // Seed one active mapping per current active RVSK_SPOC user's state_key.
    // DISTINCT ON (state_key) keeps a single SPOC per state if two ever collide,
    // so the partial unique index is never violated (Req 10.3).
    await queryRunner.query(`
      INSERT INTO rvsk_portal.state_spoc_mapping
        (id, state_key, spoc_user_id, is_active, assigned_at, assigned_by, created_at, updated_at)
      SELECT gen_random_uuid(), seed.state_key, seed.id, TRUE, NOW(), seed.assigned_by, NOW(), NOW()
      FROM (
        SELECT DISTINCT ON (u.state_key)
               u.state_key,
               u.id,
               COALESCE(
                 (SELECT a.id FROM rvsk_portal.portal_users a WHERE a.username = 'superadmin' LIMIT 1),
                 u.id
               ) AS assigned_by
          FROM rvsk_portal.portal_users u
         WHERE u.role = 'RVSK_SPOC'
           AND u.is_active = TRUE
           AND u.state_key IS NOT NULL
         ORDER BY u.state_key, u.created_at ASC
      ) seed
      WHERE NOT EXISTS (
        SELECT 1 FROM rvsk_portal.state_spoc_mapping m
         WHERE m.state_key = seed.state_key AND m.is_active
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS rvsk_portal.state_spoc_mapping`,
    );
  }
}

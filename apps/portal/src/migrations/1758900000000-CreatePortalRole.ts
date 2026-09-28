import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-RBAC-ROLE-002-A — Dynamic Role Management (Phase 1, step 1).
 *
 * Creates rvsk_portal.portal_role, the role master that will become the single
 * source of truth for application roles. `role_code` remains the stable
 * authorization key (equal to the existing portal_users.role / role_page_
 * defaults_v2.role strings); role_id is an internal FK added in a later
 * migration.
 *
 * SAFETY: purely additive. No existing table/column is touched. Nothing in the
 * running app reads this table yet, so creating + seeding it cannot change any
 * authorization behaviour.
 *
 * Seed policy (verified against local DB before authoring):
 *   - 8 role_codes are actually in use on portal_users:
 *     Super_Admin, RVSK_Admin, RVSK_SPOC, Ministry_Admin, State_Admin,
 *     District_Admin, Block_Admin, Viewer.
 *   - 2 further role_codes exist in role_page_defaults_v2 (RBAC grants) with no
 *     users yet: Analytics_User, Read_Only_User.
 *   The seed is the UNION of both so the master is complete and every existing
 *   portal_users.role can be backfilled to a matching role_id.
 */
export class CreatePortalRole1758900000000 implements MigrationInterface {
  name = 'CreatePortalRole1758900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.portal_role (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_code    VARCHAR(50)  NOT NULL UNIQUE,
        role_name    VARCHAR(100) NOT NULL,
        description  VARCHAR(255),
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Seed the reconciled catalog. Idempotent: ON CONFLICT (role_code) DO NOTHING
    // so re-running never duplicates or overwrites operator edits.
    await queryRunner.query(`
      INSERT INTO ${schema}.portal_role (role_code, role_name, description, is_active)
      VALUES
        ('Super_Admin',    'Super Admin',       'Full platform administrator.',              TRUE),
        ('RVSK_Admin',     'RVSK Admin',        'RVSK-level administrator.',                  TRUE),
        ('RVSK_SPOC',      'RVSK SPOC',         'RVSK single point of contact (grievances).', TRUE),
        ('Ministry_Admin', 'Ministry Admin',    'Ministry-level administrator.',              TRUE),
        ('State_Admin',    'State Admin',       'State-level administrator.',                 TRUE),
        ('District_Admin', 'District Admin',    'District-level administrator.',              TRUE),
        ('Block_Admin',    'Block Admin',       'Block-level administrator.',                 TRUE),
        ('Viewer',         'Viewer',            'Read-only viewer.',                          TRUE),
        ('Analytics_User', 'Analytics User',    'Analytics access user.',                     TRUE),
        ('Read_Only_User', 'Read Only User',    'Read-only access user.',                     TRUE)
      ON CONFLICT (role_code) DO NOTHING
    `);

    // Normalize known role-string drift BEFORE the verification gate so a fresh
    // dev/test seed (which inserts the mixed-case 'RVSK_Spoc') resolves cleanly.
    // Mirrors the fix in ADW-SQL/V_rbac_admin_access_fix.sql; no-op if no drift.
    // findByRole / RBAC is case-sensitive, so the canonical code is 'RVSK_SPOC'.
    await queryRunner.query(`
      UPDATE ${schema}.portal_users
         SET role = 'RVSK_SPOC'
       WHERE role = 'RVSK_Spoc'
    `);

    // Verification gate: every DISTINCT portal_users.role MUST have a matching
    // portal_role.role_code, otherwise the later role_id backfill would leave
    // NULLs. Fail the migration loudly rather than seed an incomplete master.
    const missing: Array<{ role: string }> = await queryRunner.query(`
      SELECT DISTINCT u.role
        FROM ${schema}.portal_users u
        LEFT JOIN ${schema}.portal_role r ON r.role_code = u.role
       WHERE r.role_code IS NULL
    `);
    if (missing.length > 0) {
      const codes = missing.map((m) => m.role).join(', ');
      throw new Error(
        `CreatePortalRole: portal_users has role(s) with no matching portal_role.role_code: [${codes}]. ` +
          `Add them to the seed before running this migration.`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';
    // Safe to drop: no FK references it yet at this point in the migration
    // chain (the role_id FK is added by a later, separately-reversible migration
    // whose down() runs first).
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}.portal_role`);
  }
}

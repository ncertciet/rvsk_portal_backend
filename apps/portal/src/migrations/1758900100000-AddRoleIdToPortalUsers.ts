import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-RBAC-ROLE-002-A — Dynamic Role Management (Phase 1, step 2).
 *
 * Adds rvsk_portal.portal_users.role_id (nullable FK -> portal_role.id) and
 * backfills it from the existing role string. The legacy `role` VARCHAR(50)
 * column is KEPT and untouched (dual-write model): every consumer of the role
 * string — RolesGuard, @Roles(...), the JWT claim, role_page_defaults_v2 RBAC
 * resolution, home.service, grievance scope — keeps working exactly as before.
 *
 * SAFETY:
 *   - Additive column, nullable, so existing INSERTs that omit role_id succeed.
 *   - ON DELETE / ON UPDATE left as default (RESTRICT) so a role cannot be
 *     deleted while users reference it.
 *   - Backfill is a pure UPDATE joining on role = role_code (verified 100%
 *     coverage against the local DB before authoring).
 *   - A verification gate asserts zero NULL role_id after backfill.
 *
 * Requires CreatePortalRole1758900000000 to have run first.
 */
export class AddRoleIdToPortalUsers1758900100000 implements MigrationInterface {
  name = 'AddRoleIdToPortalUsers1758900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';

    // 1. Add the nullable FK column (idempotent).
    await queryRunner.query(`
      ALTER TABLE ${schema}.portal_users
        ADD COLUMN IF NOT EXISTS role_id UUID NULL
    `);

    // 2. Add the FK constraint if not already present.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_schema = '${schema}'
            AND table_name = 'portal_users'
            AND constraint_name = 'fk_portal_users_role_id'
        ) THEN
          ALTER TABLE ${schema}.portal_users
            ADD CONSTRAINT fk_portal_users_role_id
            FOREIGN KEY (role_id) REFERENCES ${schema}.portal_role (id);
        END IF;
      END $$;
    `);

    // Supporting index for joins/filters on role_id.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_portal_users_role_id
        ON ${schema}.portal_users (role_id)
    `);

    // 3. Backfill role_id from the legacy role string. KEEP role populated.
    await queryRunner.query(`
      UPDATE ${schema}.portal_users u
         SET role_id = r.id
        FROM ${schema}.portal_role r
       WHERE r.role_code = u.role
         AND u.role_id IS DISTINCT FROM r.id
    `);

    // 4. Verification gate: no user may be left without a role_id.
    const orphans: Array<{ count: string }> = await queryRunner.query(`
      SELECT COUNT(*)::text AS count
        FROM ${schema}.portal_users
       WHERE role_id IS NULL
    `);
    const orphanCount = parseInt(orphans[0]?.count ?? '0', 10);
    if (orphanCount > 0) {
      throw new Error(
        `AddRoleIdToPortalUsers: ${orphanCount} portal_users row(s) have NULL role_id after backfill. ` +
          `A role string has no matching portal_role.role_code — investigate before proceeding.`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';
    await queryRunner.query(
      `DROP INDEX IF EXISTS ${schema}.idx_portal_users_role_id`,
    );
    await queryRunner.query(`
      ALTER TABLE ${schema}.portal_users
        DROP CONSTRAINT IF EXISTS fk_portal_users_role_id
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}.portal_users
        DROP COLUMN IF EXISTS role_id
    `);
  }
}

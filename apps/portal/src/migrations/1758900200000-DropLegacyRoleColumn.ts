import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-RBAC-ROLE-002-A — Phase 4 (GATED): drop the legacy portal_users.role
 * VARCHAR column.
 *
 * Precondition (must hold before running): every portal_users row has a
 * non-null role_id whose portal_role.role_code equals the legacy role string
 * (parity = 0). role_id is now the single source of truth; the entity exposes
 * `role` as a read-only accessor resolved from the portal_role relation, and
 * the JWT claim continues to carry role_code sourced via that relation.
 *
 * This migration re-verifies the parity gate inside up() and refuses to drop
 * the column if any mismatch remains, so it can never silently lose data.
 *
 * down() fully restores the column and backfills it from role_id -> role_code,
 * making Phase 4 independently reversible from Phases 1-3.
 */
export class DropLegacyRoleColumn1758900200000 implements MigrationInterface {
  name = 'DropLegacyRoleColumn1758900200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';

    // Re-verify the parity gate before the irreversible drop.
    const mismatch: Array<{ count: string }> = await queryRunner.query(`
      SELECT COUNT(*)::text AS count
        FROM ${schema}.portal_users u
        LEFT JOIN ${schema}.portal_role r ON r.id = u.role_id
       WHERE u.role_id IS NULL OR r.role_code IS DISTINCT FROM u.role
    `);
    const mismatchCount = parseInt(mismatch[0]?.count ?? '0', 10);
    if (mismatchCount > 0) {
      throw new Error(
        `DropLegacyRoleColumn: parity gate failed with ${mismatchCount} mismatch(es) ` +
          `between portal_users.role and portal_role.role_code (via role_id). ` +
          `Refusing to drop the column. Investigate before retrying.`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE ${schema}.portal_users DROP COLUMN IF EXISTS role
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';

    // Re-add the column (nullable first so the ALTER succeeds on a populated table).
    await queryRunner.query(`
      ALTER TABLE ${schema}.portal_users
        ADD COLUMN IF NOT EXISTS role VARCHAR(50)
    `);

    // Backfill from the master via role_id.
    await queryRunner.query(`
      UPDATE ${schema}.portal_users u
         SET role = r.role_code
        FROM ${schema}.portal_role r
       WHERE r.id = u.role_id
         AND (u.role IS DISTINCT FROM r.role_code)
    `);

    // Restore the original NOT NULL constraint (safe: role_id is non-null for
    // all rows per the Phase 1 backfill gate, so every role was backfilled).
    await queryRunner.query(`
      ALTER TABLE ${schema}.portal_users
        ALTER COLUMN role SET NOT NULL
    `);
  }
}

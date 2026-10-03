import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registers the "Event Management" page under the Super Admin module and grants
 * it to RVSK_Admin and Super_Admin, so the sidebar link to /rvsk/events appears
 * for those roles. Mirrors the entries added to ADW-SQL/portal_data_seed.sql for
 * fresh installs; this migration covers already-provisioned databases.
 *
 * Idempotent: page insert is ON CONFLICT (route_path) DO NOTHING; grants resolve
 * page_id by route_path and are ON CONFLICT (role, page_id) DO NOTHING.
 */
export class AddEventManagementPage1759000200000 implements MigrationInterface {
  name = 'AddEventManagementPage1759000200000';

  private static readonly ROUTE = '/rvsk/events';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const C = AddEventManagementPage1759000200000;

    // Resolve the Super Admin module id by code — environments provision module
    // ids differently (fixed vs gen_random_uuid), so never hardcode it.
    const modRows: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM rvsk_portal.module_master WHERE module_code = 'SUPERADMIN' LIMIT 1`,
    );
    if (!modRows.length) {
      // No SUPERADMIN module in this environment — nothing to attach the page to.
      return;
    }
    const moduleId = modRows[0].id;

    await queryRunner.query(
      `INSERT INTO rvsk_portal.page_master
         (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'EVENT_MANAGEMENT', 'Event Management', $2, 'Event', 8, TRUE, NOW(), NOW())
       ON CONFLICT (route_path) DO NOTHING`,
      [moduleId, C.ROUTE],
    );

    // Grant to RVSK_Admin and Super_Admin (resolve page_id via route_path so it
    // works even if the page already existed under a different id).
    for (const role of ['RVSK_Admin', 'Super_Admin']) {
      await queryRunner.query(
        `INSERT INTO rvsk_portal.role_page_defaults_v2
           (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
         SELECT gen_random_uuid(), $1, p.id, TRUE, TRUE, TRUE, TRUE, NOW(), NOW()
           FROM rvsk_portal.page_master p
          WHERE p.route_path = $2
         ON CONFLICT (role, page_id) DO NOTHING`,
        [role, C.ROUTE],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const C = AddEventManagementPage1759000200000;
    await queryRunner.query(
      `DELETE FROM rvsk_portal.role_page_defaults_v2
        WHERE page_id IN (SELECT id FROM rvsk_portal.page_master WHERE route_path = $1)`,
      [C.ROUTE],
    );
    await queryRunner.query(
      `DELETE FROM rvsk_portal.page_master WHERE route_path = $1`,
      [C.ROUTE],
    );
  }
}

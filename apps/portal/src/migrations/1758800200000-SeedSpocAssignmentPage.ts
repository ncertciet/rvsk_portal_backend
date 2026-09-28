import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-GRV-SPOC-003 — registers the "State-SPOC Assignment" admin page under
 * the ADMINISTRATION module and grants view/edit to Super_Admin and RVSK_Admin.
 * Because the RVSK sidebar is DB-driven (/menu/tree), seeding these rows is what
 * surfaces the page in the nav for those roles. Idempotent.
 */
export class SeedSpocAssignmentPage1758800200000 implements MigrationInterface {
  name = 'SeedSpocAssignmentPage1758800200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        v_module_id UUID;
        v_page_id   UUID;
        v_role      TEXT;
      BEGIN
        SELECT id INTO v_module_id
        FROM rvsk_portal.module_master
        WHERE module_code IN ('SUPERADMIN', 'ADMINISTRATION')
        ORDER BY CASE module_code
                   WHEN 'SUPERADMIN' THEN 0
                   WHEN 'ADMINISTRATION' THEN 1
                 END
        LIMIT 1;

        IF v_module_id IS NULL THEN
          RAISE NOTICE 'Admin module not found; skipping SPOC assignment page seed.';
          RETURN;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM rvsk_portal.page_master WHERE page_code = 'STATE_SPOC_ASSIGNMENT') THEN
          INSERT INTO rvsk_portal.page_master
            (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
          VALUES
            (gen_random_uuid(), v_module_id, 'STATE_SPOC_ASSIGNMENT', 'State-SPOC Assignment', '/rvsk/admin/spoc-assignment', 'AdminPanelSettings', 7, TRUE, NOW(), NOW());
        END IF;

        SELECT id INTO v_page_id
        FROM rvsk_portal.page_master
        WHERE page_code = 'STATE_SPOC_ASSIGNMENT'
        LIMIT 1;

        FOREACH v_role IN ARRAY ARRAY['Super_Admin', 'RVSK_Admin']
        LOOP
          IF NOT EXISTS (
            SELECT 1 FROM rvsk_portal.role_page_defaults_v2
            WHERE role = v_role AND page_id = v_page_id
          ) THEN
            INSERT INTO rvsk_portal.role_page_defaults_v2
              (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
            VALUES
              (gen_random_uuid(), v_role, v_page_id, TRUE, TRUE, FALSE, FALSE, NOW(), NOW());
          END IF;
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM rvsk_portal.role_page_defaults_v2
      WHERE page_id IN (
        SELECT id FROM rvsk_portal.page_master WHERE page_code = 'STATE_SPOC_ASSIGNMENT'
      );
    `);
    await queryRunner.query(`
      DELETE FROM rvsk_portal.page_master WHERE page_code = 'STATE_SPOC_ASSIGNMENT';
    `);
  }
}

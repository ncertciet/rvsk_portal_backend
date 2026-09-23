import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-NOTIFY-EMAIL-003 — seed the RBAC pages for the notification UI and grant
 * Super_Admin view/edit defaults.
 *
 * Registers two pages (Email Notifications, Notification Logs) under the admin
 * module and grants Super_Admin defaults. Fully idempotent (safe to re-run) via
 * NOT EXISTS guards, so it can also be executed against an environment that was
 * partially seeded by hand.
 *
 * Module-code resilience: some environments seed the admin module as
 * 'ADMINISTRATION' (see postgres_master_seed.sql / postgres_seed.sql) while the
 * original standalone seed_notification_pages.sql expected 'SUPERADMIN'. This
 * migration resolves the module by EITHER code so it works regardless of which
 * name the target database has. If neither exists it logs a NOTICE and skips
 * (the migration is still recorded as run — see note in down()).
 */
export class SeedNotificationPages1758700300000 implements MigrationInterface {
  name = 'SeedNotificationPages1758700300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Single anonymous code block: it must be executed whole (not split on ';')
    // because it contains a PL/pgSQL DO $$ ... $$ body.
    await queryRunner.query(`
      DO $$
      DECLARE
        v_module_id UUID;
        v_page_id   UUID;
      BEGIN
        -- Resolve the admin module by either the new or legacy code.
        SELECT id INTO v_module_id
        FROM rvsk_portal.module_master
        WHERE module_code IN ('SUPERADMIN', 'ADMINISTRATION')
        ORDER BY CASE module_code
                   WHEN 'SUPERADMIN' THEN 0
                   WHEN 'ADMINISTRATION' THEN 1
                 END
        LIMIT 1;

        IF v_module_id IS NULL THEN
          RAISE NOTICE 'Admin module (SUPERADMIN/ADMINISTRATION) not found; skipping notification page seed.';
          RETURN;
        END IF;

        -- Page 1: Email Notification Configuration
        IF NOT EXISTS (SELECT 1 FROM rvsk_portal.page_master WHERE page_code = 'NOTIFICATION_CONFIG') THEN
          INSERT INTO rvsk_portal.page_master
            (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
          VALUES
            (gen_random_uuid(), v_module_id, 'NOTIFICATION_CONFIG', 'Email Notifications', '/rvsk/admin/notifications', 'Email', 5, TRUE, NOW(), NOW());
        END IF;

        -- Page 2: Notification Logs
        IF NOT EXISTS (SELECT 1 FROM rvsk_portal.page_master WHERE page_code = 'NOTIFICATION_LOGS') THEN
          INSERT INTO rvsk_portal.page_master
            (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
          VALUES
            (gen_random_uuid(), v_module_id, 'NOTIFICATION_LOGS', 'Notification Logs', '/rvsk/admin/notifications/logs', 'History', 6, TRUE, NOW(), NOW());
        END IF;

        -- Grant Super_Admin view/edit defaults for both pages (idempotent).
        FOR v_page_id IN
          SELECT id FROM rvsk_portal.page_master
          WHERE page_code IN ('NOTIFICATION_CONFIG', 'NOTIFICATION_LOGS')
        LOOP
          IF NOT EXISTS (
            SELECT 1 FROM rvsk_portal.role_page_defaults_v2
            WHERE role = 'Super_Admin' AND page_id = v_page_id
          ) THEN
            INSERT INTO rvsk_portal.role_page_defaults_v2
              (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
            VALUES
              (gen_random_uuid(), 'Super_Admin', v_page_id, TRUE, TRUE, FALSE, FALSE, NOW(), NOW());
          END IF;
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the Super_Admin defaults first (FK to page_master), then the pages.
    await queryRunner.query(`
      DELETE FROM rvsk_portal.role_page_defaults_v2
      WHERE role = 'Super_Admin'
        AND page_id IN (
          SELECT id FROM rvsk_portal.page_master
          WHERE page_code IN ('NOTIFICATION_CONFIG', 'NOTIFICATION_LOGS')
        );
    `);
    await queryRunner.query(`
      DELETE FROM rvsk_portal.page_master
      WHERE page_code IN ('NOTIFICATION_CONFIG', 'NOTIFICATION_LOGS');
    `);
  }
}

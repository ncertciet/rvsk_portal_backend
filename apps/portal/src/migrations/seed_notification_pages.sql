-- RVSK-NOTIFY-EMAIL-003 — seed Super Admin RBAC pages for the notification UI.
-- Idempotent: safe to re-run. Registers 3 pages under the SUPERADMIN module and
-- grants Super_Admin view/edit defaults.

DO $$
DECLARE
  v_module_id UUID;
  v_page_id   UUID;
BEGIN
  SELECT id INTO v_module_id FROM rvsk_portal.module_master WHERE module_code = 'SUPERADMIN';
  IF v_module_id IS NULL THEN
    RAISE NOTICE 'SUPERADMIN module not found; skipping notification page seed.';
    RETURN;
  END IF;

  -- Page 1: Email Notification Configuration
  IF NOT EXISTS (SELECT 1 FROM rvsk_portal.page_master WHERE page_code = 'NOTIFICATION_CONFIG') THEN
    INSERT INTO rvsk_portal.page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), v_module_id, 'NOTIFICATION_CONFIG', 'Email Notifications', '/rvsk/admin/notifications', 'Email', 5, TRUE, NOW(), NOW());
  END IF;

  -- Page 2: Notification Logs
  IF NOT EXISTS (SELECT 1 FROM rvsk_portal.page_master WHERE page_code = 'NOTIFICATION_LOGS') THEN
    INSERT INTO rvsk_portal.page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), v_module_id, 'NOTIFICATION_LOGS', 'Notification Logs', '/rvsk/admin/notifications/logs', 'History', 6, TRUE, NOW(), NOW());
  END IF;

  -- Grant Super_Admin view/edit defaults for both pages (idempotent).
  FOR v_page_id IN
    SELECT id FROM rvsk_portal.page_master WHERE page_code IN ('NOTIFICATION_CONFIG', 'NOTIFICATION_LOGS')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM rvsk_portal.role_page_defaults_v2
      WHERE role = 'Super_Admin' AND page_id = v_page_id
    ) THEN
      INSERT INTO rvsk_portal.role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
      VALUES (gen_random_uuid(), 'Super_Admin', v_page_id, TRUE, TRUE, FALSE, FALSE, NOW(), NOW());
    END IF;
  END LOOP;
END $$;

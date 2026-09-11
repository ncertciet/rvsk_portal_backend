-- ============================================================
-- RVSK Portal — RBAC Access Fix (idempotent migration)
-- ============================================================
-- Purpose:
--   Fixes "admin login can't see many pages" by filling the gaps
--   in role_page_defaults_v2 that drive the dynamic menu
--   (GET /api/v1/menu/tree). RBAC is deny-by-default: a page is
--   only visible when a role_page_defaults_v2 row with can_view=true
--   exists for the user's role. Modules with zero visible pages are
--   dropped from the sidebar entirely.
--
-- What it does:
--   1. Grants RVSK_Admin the 3 missing Administration pages
--      (Module Admin, Page Admin, Permission Admin) so RVSK_Admin
--      can fully use the RBAC configuration console.
--   2. Grants full page access to Ministry_Admin (national admin
--      role that previously had ZERO grants -> empty menu).
--   3. Grants an appropriate page set to Block_Admin (previously
--      zero grants).
--   4. Grants a read-only view set to Viewer (previously zero grants).
--
-- Safety:
--   * Idempotent — safe to run repeatedly. Uses ON CONFLICT on the
--     (role, page_id) unique constraint; existing rows are left as-is.
--   * Non-destructive — only INSERTs grants, never deletes access.
--   * Joins page_master by page_code so it stays correct even if
--     page UUIDs differ between environments.
--
-- Usage (psql):
--   \i V_rbac_admin_access_fix.sql
--
-- IMPORTANT — menu cache:
--   The active NestJS portal service (rvsk-backend, apps/portal) caches the
--   resolved menu tree in Redis under keys `menu:<userId>:<role>` with a
--   300s TTL. Because this script writes grants directly to the database, it
--   does NOT trigger the service's cache invalidation. After running it,
--   affected users may keep seeing the old menu for up to 5 minutes, or until
--   the cache is cleared. To apply immediately:
--     * flush the menu cache in Redis:  redis-cli --scan --pattern 'menu:*' | xargs redis-cli del
--       (or simply: redis-cli FLUSHDB on the portal's Redis DB), OR
--     * restart the portal service, OR
--     * have the affected user log out and back in after the TTL elapses.
--   If Redis is not running, the service resolves fresh from the DB every
--   request and no cache action is needed.
-- ============================================================

SET search_path TO rvsk_portal;

-- ------------------------------------------------------------
-- 0) Normalize role-string drift so users match role defaults.
--    'RVSK_Spoc' (mixed case) must be 'RVSK_SPOC' to resolve the
--    seeded RVSK_SPOC page grants (findByRole is case-sensitive).
-- ------------------------------------------------------------
UPDATE portal_users SET role = 'RVSK_SPOC', updated_at = NOW() WHERE role = 'RVSK_Spoc';

-- ------------------------------------------------------------
-- Helper: grant a role can_view (+ optional flags) on a set of
-- page_codes, idempotently. Implemented inline per role below.
-- ------------------------------------------------------------

-- 1) RVSK_Admin — add the 3 missing admin console pages.
--    (USER_MGMT is already granted in the base seed.)
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
SELECT gen_random_uuid(), 'RVSK_Admin', p.id, true, true, false, false, NOW(), NOW()
FROM page_master p
WHERE p.page_code IN ('MODULE_ADMIN', 'PAGE_ADMIN', 'PERMISSION_ADMIN')
ON CONFLICT (role, page_id) DO NOTHING;

-- 2) Ministry_Admin — national oversight role. Grant view on all
--    dashboard/analytics/accreditation/grievance pages plus My Account.
--    (Excludes user/module/page/permission administration, which stays
--     with Super_Admin / RVSK_Admin.)
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
SELECT gen_random_uuid(), 'Ministry_Admin', p.id, true, false, true, false, NOW(), NOW()
FROM page_master p
JOIN module_master m ON m.id = p.module_id
WHERE m.module_code IN (
        'HOME', 'ATTENDANCE', 'ASSESSMENT', 'SCHEMES',
        'ACCREDITATION', 'GRIEVANCES', 'MY_ACCOUNT'
      )
ON CONFLICT (role, page_id) DO NOTHING;

-- 3) Block_Admin — block-level operational role. Grant Home, the
--    attendance dashboards, grievances and My Account.
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
SELECT gen_random_uuid(), 'Block_Admin', p.id, true, false, false, false, NOW(), NOW()
FROM page_master p
JOIN module_master m ON m.id = p.module_id
WHERE m.module_code IN ('HOME', 'ATTENDANCE', 'GRIEVANCES', 'MY_ACCOUNT')
ON CONFLICT (role, page_id) DO NOTHING;

-- Block_Admin can raise grievances (edit on the raise-grievance page).
UPDATE role_page_defaults_v2 d
SET can_edit = true, updated_at = NOW()
FROM page_master p
WHERE d.page_id = p.id
  AND d.role = 'Block_Admin'
  AND p.page_code = 'RAISE_GRIEVANCE';

-- 4) Viewer — read-only role. Grant Home + core dashboards + My Account,
--    view-only (no edit/export/delete).
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
SELECT gen_random_uuid(), 'Viewer', p.id, true, false, false, false, NOW(), NOW()
FROM page_master p
JOIN module_master m ON m.id = p.module_id
WHERE (
        (m.module_code = 'HOME')
        OR (m.module_code = 'ATTENDANCE' AND p.page_code IN ('SUMMARY', 'TRENDS', 'REPORT'))
        OR (m.module_code = 'ASSESSMENT' AND p.page_code IN ('OVERVIEW', 'RANKINGS'))
        OR (m.module_code = 'MY_ACCOUNT')
      )
ON CONFLICT (role, page_id) DO NOTHING;

-- ------------------------------------------------------------
-- Verification — row counts per role after the fix.
-- ------------------------------------------------------------
SELECT role, COUNT(*) AS granted_pages
FROM role_page_defaults_v2
GROUP BY role
ORDER BY granted_pages DESC;

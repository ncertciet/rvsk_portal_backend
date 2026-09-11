-- ============================================================
-- RVSK Portal — Accreditation Sub-Menu Fix (ORACLE ADW, schema RTIWARI)
--
-- WHY THIS IS NEEDED:
--   The left-sidebar menu is served by rvsk-auth-service from the Oracle
--   ADW database (schema RTIWARI), NOT from the Postgres seed file.
--   MenuServiceImpl builds the menu ONLY from pages the user's role can view:
--     - PAGE_MASTER row must exist and IS_ACTIVE = 1
--     - ROLE_PAGE_DEFAULTS_V2 row must exist for the role with CAN_VIEW = 1
--   A module with zero viewable pages is dropped entirely — which is why
--   "Accreditation" shows no expand arrow / sub-menu.
--
-- Module: ACCREDITATION = 585ac338-64a9-390f-e063-e212000a5960
--
-- IMPORTANT: PAGE_MASTER.ID and MODULE_ID are RAW(16). Below we use
--   HEXTORAW(...) with the hyphen-free hex of each UUID.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- STEP 0 — VERIFY: what does Oracle actually have right now?
-- Run these SELECTs first to see the current state.
-- ─────────────────────────────────────────────────────────────

-- 0a) Which pages exist under the ACCREDITATION module?
SELECT RAWTOHEX(id) AS page_id, page_code, page_name, route_path, display_order, is_active
FROM   RTIWARI.PAGE_MASTER
WHERE  module_id = HEXTORAW('585ac338');  -- placeholder; replace with full RAW below
-- Correct filter (full 32-hex, hyphens removed):
-- WHERE module_id = HEXTORAW('585AC33864A9390FE063E212000A5960');

-- 0b) What role-page grants exist for those pages? (replace :ROLE, e.g. 'Super_Admin')
SELECT rpd.role, p.page_code, rpd.can_view
FROM   RTIWARI.ROLE_PAGE_DEFAULTS_V2 rpd
JOIN   RTIWARI.PAGE_MASTER p ON p.id = rpd.page_id
WHERE  p.module_id = HEXTORAW('585AC33864A9390FE063E212000A5960');

-- 0c) What is YOUR role string? Check the ALLOWED list the service accepts
--     (typically: Super_Admin, RVSK_Admin, Ministry_Admin, State_Admin, ...).


-- ─────────────────────────────────────────────────────────────
-- STEP 1 — ENSURE the 5 pages exist and are ACTIVE.
-- (Skip inserts you already have. is_active MUST be 1.)
-- UUIDs -> RAW(16) hex:
--   585ac338-64c3-390f-e063-e212000a5960 -> 585AC33864C3390FE063E212000A5960 (Programme)
--   a1b2c3d4-0002-4000-8000-000000000002 -> A1B2C3D400024000800000000000 0002 (Coverage)
--   a1b2c3d4-0003-4000-8000-000000000003 -> Process
--   a1b2c3d4-0004-4000-8000-000000000004 -> Data Quality
--   a1b2c3d4-0005-4000-8000-000000000005 -> Impact
-- ─────────────────────────────────────────────────────────────

-- If your existing rows are inactive, activate them:
UPDATE RTIWARI.PAGE_MASTER
SET    is_active = 1, updated_at = SYSTIMESTAMP
WHERE  module_id = HEXTORAW('585AC33864A9390FE063E212000A5960')
AND    page_code IN ('ACCR_PROGRAMME','ACCR_COVERAGE','ACCR_PROCESS','ACCR_DATA_QUALITY','ACCR_IMPACT');


-- ─────────────────────────────────────────────────────────────
-- STEP 2 — GRANT view permission to your role for all 5 pages.
-- This is the step that actually makes the sub-menu appear.
-- Replace 'Super_Admin' with your exact role if different.
-- Insert one grant per (role, page) that does not already exist.
-- ─────────────────────────────────────────────────────────────

INSERT INTO RTIWARI.ROLE_PAGE_DEFAULTS_V2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
SELECT SYS_GUID(), 'Super_Admin', p.id, 1, 0, 0, 0, SYSTIMESTAMP, SYSTIMESTAMP
FROM   RTIWARI.PAGE_MASTER p
WHERE  p.module_id = HEXTORAW('585AC33864A9390FE063E212000A5960')
AND    p.page_code IN ('ACCR_PROGRAMME','ACCR_COVERAGE','ACCR_PROCESS','ACCR_DATA_QUALITY','ACCR_IMPACT')
AND    NOT EXISTS (
         SELECT 1 FROM RTIWARI.ROLE_PAGE_DEFAULTS_V2 x
         WHERE  x.role = 'Super_Admin' AND x.page_id = p.id
       );

COMMIT;


-- ─────────────────────────────────────────────────────────────
-- STEP 3 — RE-VERIFY (should return 5 rows, all can_view = 1)
-- ─────────────────────────────────────────────────────────────
SELECT rpd.role, p.page_code, p.route_path, rpd.can_view, p.is_active, p.display_order
FROM   RTIWARI.ROLE_PAGE_DEFAULTS_V2 rpd
JOIN   RTIWARI.PAGE_MASTER p ON p.id = rpd.page_id
WHERE  p.module_id = HEXTORAW('585AC33864A9390FE063E212000A5960')
AND    rpd.role = 'Super_Admin'
ORDER  BY p.display_order;

-- After this, log out/in (or refresh) so the frontend re-fetches /menu/tree.
-- The Accreditation item should now show an expand arrow with 5 sub-menus.

-- ============================================================
-- RVSK Portal â€” PostgreSQL Seed Data
-- Database: rvsk_portal, Schema: rvsk_portal
-- Run AFTER postgres_init.sql
-- ============================================================

SET search_path TO rvsk_portal;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 1. ADMIN USERS
-- Password for all test users: Admin@123
-- BCrypt hash (cost 10): $2b$10$JWi3FknTY9AfCpakU1p5NO./c1pShrnfA3zxjrwqIz0Mp7mNccYnO
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'superadmin', 'Super Administrator', '$2b$10$JWi3FknTY9AfCpakU1p5NO./c1pShrnfA3zxjrwqIz0Mp7mNccYnO', 'Super_Admin', NULL, NULL, true, false, 0, NOW(), NOW()),
  (gen_random_uuid(), 'rvskadmin', 'RVSK Administrator', '$2b$10$JWi3FknTY9AfCpakU1p5NO./c1pShrnfA3zxjrwqIz0Mp7mNccYnO', 'RVSK_Admin', NULL, NULL, true, false, 0, NOW(), NOW()),
  (gen_random_uuid(), 'spoc_dl', 'Delhi SPOC User', '$2b$10$JWi3FknTY9AfCpakU1p5NO./c1pShrnfA3zxjrwqIz0Mp7mNccYnO', 'RVSK_SPOC', '07', NULL, true, false, 0, NOW(), NOW()),
  (gen_random_uuid(), 'spoc_mh', 'Maharashtra SPOC User', '$2b$10$JWi3FknTY9AfCpakU1p5NO./c1pShrnfA3zxjrwqIz0Mp7mNccYnO', 'RVSK_SPOC', '27', NULL, true, false, 0, NOW(), NOW()),
  (gen_random_uuid(), 'stateadmin_dl', 'Delhi State Admin', '$2b$10$JWi3FknTY9AfCpakU1p5NO./c1pShrnfA3zxjrwqIz0Mp7mNccYnO', 'State_Admin', '07', NULL, true, false, 0, NOW(), NOW()),
  (gen_random_uuid(), 'stateadmin_mh', 'Maharashtra State Admin', '$2b$10$JWi3FknTY9AfCpakU1p5NO./c1pShrnfA3zxjrwqIz0Mp7mNccYnO', 'State_Admin', '27', NULL, true, false, 0, NOW(), NOW()),
  (gen_random_uuid(), 'distadmin_dl01', 'Delhi District Admin', '$2b$10$JWi3FknTY9AfCpakU1p5NO./c1pShrnfA3zxjrwqIz0Mp7mNccYnO', 'District_Admin', '07', '0701', true, false, 0, NOW(), NOW());


-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 2. MODULES (Menu Structure)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

INSERT INTO module_master (id, module_code, module_name, icon, display_order, is_active, created_at, updated_at) VALUES
  (gen_random_uuid(), 'HOME', 'Home', 'Home', 1, true, NOW(), NOW()),
  (gen_random_uuid(), 'ATTENDANCE', 'Attendance', 'School', 2, true, NOW(), NOW()),
  (gen_random_uuid(), 'ASSESSMENT', 'Assessment', 'Assessment', 3, true, NOW(), NOW()),
  (gen_random_uuid(), 'SCHEMES', 'Schemes & Programs', 'AccountBalance', 4, true, NOW(), NOW()),
  (gen_random_uuid(), 'ACCREDITATION', 'Accreditation', 'Verified', 5, true, NOW(), NOW()),
  (gen_random_uuid(), 'VSK_MANAGEMENT', 'VSK Management', 'Apartment', 6, true, NOW(), NOW()),
  (gen_random_uuid(), 'FORMS', 'Forms', 'DynamicForm', 7, true, NOW(), NOW()),
  (gen_random_uuid(), 'GRIEVANCES', 'Grievances', 'Description', 8, true, NOW(), NOW()),
  (gen_random_uuid(), 'ADMINISTRATION', 'Administration', 'AdminPanelSettings', 9, true, NOW(), NOW()),
  (gen_random_uuid(), 'MY_ACCOUNT', 'My Account', 'Person', 10, true, NOW(), NOW());

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 3. PAGES (Menu Items)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- HOME pages
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'HOME_PAGE', 'Home', '/rvsk/home', 'Home', 1, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'HOME';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'DASHBOARD', 'Dashboard', '/rvsk/dashboard', 'Dashboard', 2, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'HOME';

-- ATTENDANCE pages
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'SUMMARY', 'Summary', '/rvsk/dashboard/attendance/summary', 'Summarize', 1, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'ATTENDANCE';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'DETAILED_DATA', 'Detailed Data', '/rvsk/dashboard/attendance/detailed', 'TableChart', 2, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'ATTENDANCE';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'TRENDS', 'Trends', '/rvsk/dashboard/attendance/trends', 'TrendingUp', 3, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'ATTENDANCE';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'TABLE_VIEW', 'Table View', '/rvsk/dashboard/attendance/table', 'ViewList', 4, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'ATTENDANCE';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'SCHOOL', 'School Directory', '/rvsk/dashboard/attendance/school', 'LocationCity', 5, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'ATTENDANCE';

-- SCHEMES pages
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'PMSHRI', 'PM SHRI', '/rvsk/dashboard/pm-shri', 'Star', 1, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'SCHEMES';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'MICRO_IMPROVEMENT', 'Micro Improvement', '/rvsk/dashboard/micro-improvement', 'TipsAndUpdates', 2, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'SCHEMES';

-- ACCREDITATION pages
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'ACCRED_DASHBOARD', 'Dashboard', '/rvsk/dashboard/accreditation', 'Dashboard', 1, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'ACCREDITATION';

-- VSK_MANAGEMENT pages
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'VSK_DETAILS', 'VSK Details', '/rvsk/vsk-details', 'Info', 1, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'VSK_MANAGEMENT';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'VSK_ADMIN', 'VSK Admin', '/rvsk/vsk-admin', 'Settings', 2, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'VSK_MANAGEMENT';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'GALLERY_UPLOAD', 'Gallery Upload', '/rvsk/gallery/upload', 'PhotoLibrary', 3, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'VSK_MANAGEMENT';

-- FORMS pages
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'FORM_BUILDER', 'Form Builder', '/rvsk/form-builder', 'DynamicForm', 1, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'FORMS';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'MY_FORMS', 'My Forms', '/rvsk/my-forms', 'Assignment', 2, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'FORMS';

-- GRIEVANCES pages
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'GRIEVANCE_DASHBOARD', 'Dashboard', '/rvsk/grievances', 'Dashboard', 1, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'GRIEVANCES';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'RAISE_GRIEVANCE', 'Raise Grievance', '/rvsk/grievances/raise', 'AddComment', 2, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'GRIEVANCES';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'GRIEVANCE_LIST', 'All Grievances', '/rvsk/grievances/list', 'List', 3, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'GRIEVANCES';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'CATEGORIES', 'Categories', '/rvsk/grievances/categories', 'Category', 4, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'GRIEVANCES';

-- ADMINISTRATION pages
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'USER_MGMT', 'User Management', '/rvsk/admin/users', 'People', 1, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'ADMINISTRATION';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'MODULE_ADMIN', 'Module Admin', '/rvsk/admin/modules', 'ViewModule', 2, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'ADMINISTRATION';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'PAGE_ADMIN', 'Page Admin', '/rvsk/admin/pages', 'Web', 3, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'ADMINISTRATION';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'PERMISSION_ADMIN', 'Permission Admin', '/rvsk/admin/permissions', 'Security', 4, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'ADMINISTRATION';

-- MY_ACCOUNT pages
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'PROFILE', 'My Profile', '/rvsk/profile', 'Person', 1, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'MY_ACCOUNT';

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), m.id, 'CHANGE_PASSWORD', 'Change Password', '/rvsk/change-password', 'Lock', 2, true, NOW(), NOW()
FROM module_master m WHERE m.module_code = 'MY_ACCOUNT';


-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 4. ROLE-PAGE PERMISSIONS (Super_Admin gets all, others get subset)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Super_Admin: full access to ALL pages
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
SELECT gen_random_uuid(), 'Super_Admin', p.id, true, true, true, true, NOW(), NOW()
FROM page_master p;

-- RVSK_Admin: view+edit on most, no admin delete
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
SELECT gen_random_uuid(), 'RVSK_Admin', p.id, true, true, true, false, NOW(), NOW()
FROM page_master p
WHERE p.page_code NOT IN ('MODULE_ADMIN', 'PAGE_ADMIN', 'PERMISSION_ADMIN');

-- RVSK_SPOC: grievances + home + account
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
SELECT gen_random_uuid(), 'RVSK_SPOC', p.id, true, true, true, false, NOW(), NOW()
FROM page_master p
JOIN module_master m ON p.module_id = m.id
WHERE m.module_code IN ('HOME', 'GRIEVANCES', 'MY_ACCOUNT');

-- State_Admin: home + attendance + VSK + forms + grievances + account
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
SELECT gen_random_uuid(), 'State_Admin', p.id, true, 
  CASE WHEN m.module_code IN ('VSK_MANAGEMENT', 'GRIEVANCES') THEN true ELSE false END,
  CASE WHEN m.module_code IN ('ATTENDANCE') THEN true ELSE false END,
  false, NOW(), NOW()
FROM page_master p
JOIN module_master m ON p.module_id = m.id
WHERE m.module_code IN ('HOME', 'ATTENDANCE', 'VSK_MANAGEMENT', 'FORMS', 'GRIEVANCES', 'MY_ACCOUNT');

-- District_Admin: home + grievances (own) + forms (my) + account
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
SELECT gen_random_uuid(), 'District_Admin', p.id, true, false, false, false, NOW(), NOW()
FROM page_master p
JOIN module_master m ON p.module_id = m.id
WHERE m.module_code IN ('HOME', 'MY_ACCOUNT')
   OR p.page_code IN ('GRIEVANCE_DASHBOARD', 'RAISE_GRIEVANCE', 'GRIEVANCE_LIST', 'MY_FORMS');

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 5. GRIEVANCE CATEGORIES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active) VALUES
  ('INFRASTRUCTURE', 'Infrastructure', NULL, 1, true),
  ('INFRA_BUILDING', 'Building Issues', 'INFRASTRUCTURE', 1, true),
  ('INFRA_NETWORK', 'Network/Internet', 'INFRASTRUCTURE', 2, true),
  ('INFRA_EQUIPMENT', 'Equipment/Hardware', 'INFRASTRUCTURE', 3, true),
  ('SOFTWARE', 'Software & Applications', NULL, 2, true),
  ('SW_LMS', 'Learning Management System', 'SOFTWARE', 1, true),
  ('SW_PORTAL', 'Portal Issues', 'SOFTWARE', 2, true),
  ('TRAINING', 'Training & Capacity Building', NULL, 3, true),
  ('TRAIN_SCHEDULE', 'Training Schedule', 'TRAINING', 1, true),
  ('TRAIN_CONTENT', 'Training Content', 'TRAINING', 2, true),
  ('DATA', 'Data & Reports', NULL, 4, true),
  ('DATA_QUALITY', 'Data Quality Issues', 'DATA', 1, true),
  ('DATA_ACCESS', 'Data Access Issues', 'DATA', 2, true),
  ('OTHER', 'Other', NULL, 5, true),
  ('OTHER_GENERAL', 'General Query', 'OTHER', 1, true);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- 6. SAMPLE GRIEVANCES (for testing)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

INSERT INTO grievances (id, grievance_id, created_by, state_code, district_code, assigned_to, category, sub_category, subject, description, status, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'GRV-07-20260810-0001',
  (SELECT id FROM portal_users WHERE username = 'stateadmin_dl'),
  '07', '0701',
  (SELECT id FROM portal_users WHERE username = 'spoc_dl'),
  'INFRASTRUCTURE', 'INFRA_NETWORK',
  'Internet connectivity issue at VSK Delhi',
  'The VSK center in Delhi is experiencing frequent internet outages. This is affecting the training sessions.',
  'ASSIGNED',
  NOW() - interval '2 days',
  NOW() - interval '2 days';

INSERT INTO grievances (id, grievance_id, created_by, state_code, district_code, category, sub_category, subject, description, status, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'GRV-27-20260810-0001',
  (SELECT id FROM portal_users WHERE username = 'stateadmin_mh'),
  '27', NULL,
  'SOFTWARE', 'SW_PORTAL',
  'Portal login issue for teachers',
  'Multiple teachers in Maharashtra are unable to log in to the portal. Getting timeout errors.',
  'OPEN',
  NOW() - interval '1 day',
  NOW() - interval '1 day';

INSERT INTO grievances (id, grievance_id, created_by, state_code, district_code, assigned_to, category, subject, description, status, created_at, updated_at, resolved_at)
SELECT
  gen_random_uuid(),
  'GRV-07-20260808-0001',
  (SELECT id FROM portal_users WHERE username = 'distadmin_dl01'),
  '07', '0701',
  (SELECT id FROM portal_users WHERE username = 'spoc_dl'),
  'TRAINING', 'Need training on new assessment module',
  'Our district needs a training session on the new NAS assessment module.',
  'CLOSED',
  NOW() - interval '5 days',
  NOW() - interval '1 day',
  NOW() - interval '1 day';

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Done! Test credentials:
-- Username: superadmin / Password: Admin@123
-- Username: rvskadmin / Password: Admin@123
-- Username: spoc_dl / Password: Admin@123
-- Username: stateadmin_dl / Password: Admin@123
-- Username: stateadmin_mh / Password: Admin@123
-- Username: distadmin_dl01 / Password: Admin@123
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

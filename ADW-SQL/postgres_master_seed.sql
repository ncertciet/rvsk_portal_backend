-- ============================================================
-- RVSK Portal — PostgreSQL Master Seed Data (extracted from Oracle ADW)
-- Database: rvsk_accreditation, Schema: rvsk_portal
-- Generated: 2026-08-11T07:24:21.486Z
-- ============================================================

SET search_path TO rvsk_portal;

-- Clear existing data (in correct order for FK constraints)
-- First: tables that reference portal_users
DELETE FROM grievance_responses;
DELETE FROM grievance_history;
DELETE FROM grievance_attachments;
DELETE FROM grievances;
DELETE FROM form_response_detail;
DELETE FROM form_response;
DELETE FROM form_assignment;
DELETE FROM form_question;
DELETE FROM form_master;
DELETE FROM vsk_officer_history;
DELETE FROM vsk_committee_member;
DELETE FROM vsk_pmu_role_structure;
DELETE FROM vsk_pmu_header;
DELETE FROM vsk_software_item;
DELETE FROM vsk_software_header;
DELETE FROM vsk_infra_hardware;
DELETE FROM vsk_profile;
DELETE FROM vsk_gallery_images;
DELETE FROM activity_log;
-- Then: RBAC and core tables
DELETE FROM role_page_defaults_v2;
DELETE FROM user_page_overrides_v2;
DELETE FROM grievance_categories;
DELETE FROM page_master;
DELETE FROM module_master;
DELETE FROM portal_users;

-- ═══════════════════════════════════════════════════════════════
-- MODULES
-- ═══════════════════════════════════════════════════════════════

INSERT INTO module_master (id, module_code, module_name, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64a5-390f-e063-e212000a5960', 'HOME', 'Home', 'Home', 1, true, NOW(), NOW());
INSERT INTO module_master (id, module_code, module_name, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64a6-390f-e063-e212000a5960', 'ATTENDANCE', 'Attendance', 'School', 2, true, NOW(), NOW());
INSERT INTO module_master (id, module_code, module_name, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64a7-390f-e063-e212000a5960', 'ASSESSMENT', 'Assessment', 'Assessment', 3, true, NOW(), NOW());
INSERT INTO module_master (id, module_code, module_name, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64a8-390f-e063-e212000a5960', 'SCHEMES', 'Schemes all', 'AccountBalance', 4, true, NOW(), NOW());
INSERT INTO module_master (id, module_code, module_name, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64a9-390f-e063-e212000a5960', 'ACCREDITATION', 'Accreditation', 'Verified', 5, true, NOW(), NOW());
INSERT INTO module_master (id, module_code, module_name, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64aa-390f-e063-e212000a5960', 'VSK_MANAGEMENT', 'VSK Management', 'Apartment', 6, true, NOW(), NOW());
INSERT INTO module_master (id, module_code, module_name, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64ab-390f-e063-e212000a5960', 'FORMS', 'Forms', 'DynamicForm', 7, true, NOW(), NOW());
INSERT INTO module_master (id, module_code, module_name, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64ac-390f-e063-e212000a5960', 'GRIEVANCES', 'Grievances', 'Description', 8, true, NOW(), NOW());
INSERT INTO module_master (id, module_code, module_name, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64ad-390f-e063-e212000a5960', 'ADMINISTRATION', 'Administration', 'AdminPanelSettings', 9, true, NOW(), NOW());
INSERT INTO module_master (id, module_code, module_name, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64ae-390f-e063-e212000a5960', 'MY_ACCOUNT', 'My Account', 'Person', 10, true, NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════
-- PAGES
-- ═══════════════════════════════════════════════════════════════

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64af-390f-e063-e212000a5960', '585ac338-64a5-390f-e063-e212000a5960', 'HOME_PAGE', 'Home', '/rvsk/home', 'Home', 1, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64b0-390f-e063-e212000a5960', '585ac338-64a5-390f-e063-e212000a5960', 'DASHBOARD', 'Dashboard', '/rvsk/dashboard', 'Dashboard', 2, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64b1-390f-e063-e212000a5960', '585ac338-64a6-390f-e063-e212000a5960', 'SUMMARY', 'Summary', '/rvsk/dashboard/attendance/summary', 'Summarize', 1, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64b2-390f-e063-e212000a5960', '585ac338-64a6-390f-e063-e212000a5960', 'DETAILED_DATA', 'Detailed Data', '/rvsk/dashboard/attendance/detailed', 'TableChart', 2, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64b3-390f-e063-e212000a5960', '585ac338-64a6-390f-e063-e212000a5960', 'TRENDS', 'Trends', '/rvsk/dashboard/attendance/trends', 'TrendingUp', 3, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64b4-390f-e063-e212000a5960', '585ac338-64a6-390f-e063-e212000a5960', 'REPORT', 'Report View', '/rvsk/dashboard/attendance/report', 'Description', 4, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64b5-390f-e063-e212000a5960', '585ac338-64a6-390f-e063-e212000a5960', 'TABLE_VIEW', 'Table View', '/rvsk/dashboard/attendance/table', 'ViewList', 5, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64b6-390f-e063-e212000a5960', '585ac338-64a6-390f-e063-e212000a5960', 'SCHOOL', 'School Directory', '/rvsk/dashboard/attendance/school', 'LocationCity', 6, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64b7-390f-e063-e212000a5960', '585ac338-64a6-390f-e063-e212000a5960', 'TEACHER', 'Teacher Registry', '/rvsk/dashboard/attendance/teacher', 'Group', 7, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64b8-390f-e063-e212000a5960', '585ac338-64a6-390f-e063-e212000a5960', 'STUDENT', 'Student Registry', '/rvsk/dashboard/attendance/student', 'People', 8, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64b9-390f-e063-e212000a5960', '585ac338-64a6-390f-e063-e212000a5960', 'MONTHLY', 'Monthly Details', '/rvsk/dashboard/attendance/monthly', 'CalendarMonth', 9, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64ba-390f-e063-e212000a5960', '585ac338-64a6-390f-e063-e212000a5960', 'ANALYSIS', 'Attendance Analysis', '/rvsk/dashboard/attendance/analysis', 'Analytics', 10, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64bb-390f-e063-e212000a5960', '585ac338-64a7-390f-e063-e212000a5960', 'OVERVIEW', 'Executive Overview', '/rvsk/dashboard/assessment/overview', 'Summarize', 1, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64bc-390f-e063-e212000a5960', '585ac338-64a7-390f-e063-e212000a5960', 'DEMOGRAPHICS', 'Student Demographics', '/rvsk/dashboard/assessment/demographics', 'People', 2, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64bd-390f-e063-e212000a5960', '585ac338-64a7-390f-e063-e212000a5960', 'SUBJECTS', 'Subject all', '/rvsk/dashboard/assessment/subjects', 'School', 3, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64be-390f-e063-e212000a5960', '585ac338-64a7-390f-e063-e212000a5960', 'TRENDS', 'Trends all', '/rvsk/dashboard/assessment/trends', 'TrendingUp', 4, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64bf-390f-e063-e212000a5960', '585ac338-64a7-390f-e063-e212000a5960', 'RANKINGS', 'Rankings', '/rvsk/dashboard/assessment/rankings', 'Analytics', 5, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64c0-390f-e063-e212000a5960', '585ac338-64a7-390f-e063-e212000a5960', 'QUALITY', 'Data Quality', '/rvsk/dashboard/assessment/quality', 'Verified', 6, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64c1-390f-e063-e212000a5960', '585ac338-64a8-390f-e063-e212000a5960', 'PMSHRI', 'PM SHRI', '/rvsk/dashboard/pm-shri', 'Star', 1, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64c2-390f-e063-e212000a5960', '585ac338-64a8-390f-e063-e212000a5960', 'MICRO_IMPROVEMENT', 'Micro Improvement', '/rvsk/dashboard/micro-improvement', 'TipsAndUpdates', 2, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64c3-390f-e063-e212000a5960', '585ac338-64a9-390f-e063-e212000a5960', 'DASHBOARD', 'Dashboard', '/rvsk/dashboard/accreditation', 'Dashboard', 1, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64c4-390f-e063-e212000a5960', '585ac338-64aa-390f-e063-e212000a5960', 'VSK_DETAILS', 'VSK Details', '/rvsk/vsk-details', 'Info', 1, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64c5-390f-e063-e212000a5960', '585ac338-64aa-390f-e063-e212000a5960', 'VSK_ADMIN', 'VSK Admin', '/rvsk/vsk-admin', 'Settings', 2, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64c6-390f-e063-e212000a5960', '585ac338-64aa-390f-e063-e212000a5960', 'GALLERY_UPLOAD', 'Gallery Upload', '/rvsk/gallery/upload', 'PhotoLibrary', 3, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64c7-390f-e063-e212000a5960', '585ac338-64ab-390f-e063-e212000a5960', 'FORM_BUILDER', 'Form Builder', '/rvsk/form-builder', 'DynamicForm', 1, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64c8-390f-e063-e212000a5960', '585ac338-64ab-390f-e063-e212000a5960', 'MY_FORMS', 'My Forms', '/rvsk/my-forms', 'Assignment', 2, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64c9-390f-e063-e212000a5960', '585ac338-64ac-390f-e063-e212000a5960', 'GRIEVANCE_DASHBOARD', 'Dashboard', '/rvsk/grievances', 'Dashboard', 1, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64ca-390f-e063-e212000a5960', '585ac338-64ac-390f-e063-e212000a5960', 'RAISE_GRIEVANCE', 'Raise Grievance', '/rvsk/grievances/raise', 'AddComment', 2, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64cb-390f-e063-e212000a5960', '585ac338-64ac-390f-e063-e212000a5960', 'GRIEVANCE_LIST', 'All Grievances', '/rvsk/grievances/list', 'List', 3, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64cc-390f-e063-e212000a5960', '585ac338-64ac-390f-e063-e212000a5960', 'CATEGORIES', 'Categories', '/rvsk/grievances/categories', 'Category', 4, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64cd-390f-e063-e212000a5960', '585ac338-64ad-390f-e063-e212000a5960', 'USER_MGMT', 'User Management', '/rvsk/admin/users', 'People', 1, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64ce-390f-e063-e212000a5960', '585ac338-64ad-390f-e063-e212000a5960', 'MODULE_ADMIN', 'Module Admin', '/rvsk/admin/modules', 'ViewModule', 2, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64cf-390f-e063-e212000a5960', '585ac338-64ad-390f-e063-e212000a5960', 'PAGE_ADMIN', 'Page Admin', '/rvsk/admin/pages', 'Web', 3, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64d0-390f-e063-e212000a5960', '585ac338-64ad-390f-e063-e212000a5960', 'PERMISSION_ADMIN', 'Permission Admin', '/rvsk/admin/permissions', 'Security', 4, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64d1-390f-e063-e212000a5960', '585ac338-64ae-390f-e063-e212000a5960', 'PROFILE', 'My Profile', '/rvsk/profile', 'Person', 1, true, NOW(), NOW());
INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES ('585ac338-64d2-390f-e063-e212000a5960', '585ac338-64ae-390f-e063-e212000a5960', 'CHANGE_PASSWORD', 'Change Password', '/rvsk/change-password', 'Lock', 2, true, NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════
-- PORTAL USERS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f61-8318-e063-e212000a345a', 'block.chinhat@rvsk.gov.in', 'Block Admin Chinhat', '$2a$12$o0Bbn0MNyVGq6p8CZbBQwu66PlDh.kin.LITu4DoWocGSj0Y0U4rm', 'Block_Admin', '09', '0912', true, false, 0, '4545454', 'District User', 'EDU', NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f60-8318-e063-e212000a345a', 'district.lucknow@rvsk.gov.in', 'District Admin Lucknow', '$2a$12$zPTElmZ860tN1cdYtufqd.rBGR21VrLrsrM.XmhZd8eupUvM.suSC', 'District_Admin', '09', '0912', true, false, 0, '9591518004', 'District Admin', 'School Education', NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f5e-8318-e063-e212000a345a', 'ministry.admin@rvsk.gov.in', 'Ministry Admin', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ministry_Admin', '48', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f5f-8318-e063-e212000a345a', 'rvsk.admin@rvsk.gov.in', 'RVSK Admin', '$2a$12$XYUmO4gh1mZbrqB6wpAZYeqUcztfjNIws76vHSBQMl449bqOXFdsC', 'RVSK_Admin', '49', NULL, true, false, 0, '9591510554', 'RVSK admin', 'RVVSK', NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('57ce95e9-ac93-2f7a-e063-e212000ac641', 'spoc.br@rvsk.gov.in', 'Rajesh Sharma (SPOC BR)', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'RVSK_SPOC', '10', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('57ce95e9-ac92-2f7a-e063-e212000ac641', 'spoc.mh@rvsk.gov.in', 'Arun Deshmukh (SPOC MH)', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'RVSK_SPOC', '26', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('57ce95e9-ac95-2f7a-e063-e212000ac641', 'spoc.rj@rvsk.gov.in', 'Deepak Jain (SPOC RJ)', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'RVSK_SPOC', '08', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('57ce95e9-ac94-2f7a-e063-e212000ac641', 'spoc.tn@rvsk.gov.in', 'Suresh Raman (SPOC TN)', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'RVSK_SPOC', '32', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('57ce95e9-ac91-2f7a-e063-e212000ac641', 'spoc.up@rvsk.gov.in', 'Amit Kumar (SPOC UP)', '$2a$12$TR2Y3k7fcU1DReunjnrpf.0ssgrXKwF2kC9/n3aFwshY4YAh3Bsuq', 'RVSK_SPOC', '09', NULL, true, false, 0, '9959595959', 'SPOC', 'RVSK', NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('5791fb90-a16d-4dcc-e063-e212000a03b9', 'rvsk.spoc1@rvsk.gov.in', 'RVSK Spoc1', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'RVSK_Spoc', '49', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f84-8318-e063-e212000a345a', 'vsk.an@rvsk.gov.in', 'VSK Andaman 1', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '34', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f7d-8318-e063-e212000a345a', 'vsk.ap@rvsk.gov.in', 'VSK Andhra Pradesh', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '27', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f6e-8318-e063-e212000a345a', 'vsk.ar@rvsk.gov.in', 'VSK Arunachal Pradesh', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '12', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f74-8318-e063-e212000a345a', 'vsk.as@rvsk.gov.in', 'VSK Assam', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '18', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f6c-8318-e063-e212000a345a', 'vsk.br@rvsk.gov.in', 'VSK Bihar', '$2a$12$li.D/aMk5uRQZvdbF6IeO.qMty28SuAi1uzZvnB3T5SNPFxn0z6i2', 'State_Admin', '10', NULL, true, false, 0, '8768678768', 'Nodal', 'MOE', NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f78-8318-e063-e212000a345a', 'vsk.cg@rvsk.gov.in', 'VSK Chhattisgarh', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '22', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f66-8318-e063-e212000a345a', 'vsk.ch@rvsk.gov.in', 'VSK Chandigarh', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '04', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f7b-8318-e063-e212000a345a', 'vsk.dd@rvsk.gov.in', 'VSK Dadra all Haveli', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '25', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f69-8318-e063-e212000a345a', 'vsk.dl@rvsk.gov.in', 'VSK Delhi', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '07', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f7f-8318-e063-e212000a345a', 'vsk.ga@rvsk.gov.in', 'VSK Goa', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '29', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f7a-8318-e063-e212000a345a', 'vsk.gj@rvsk.gov.in', 'VSK Gujarat', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '24', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f64-8318-e063-e212000a345a', 'vsk.hp@rvsk.gov.in', 'VSK Himachal Pradesh', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '02', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f68-8318-e063-e212000a345a', 'vsk.hr@rvsk.gov.in', 'VSK Haryana', '$2a$12$j9.2tqyuVGWPm0ArDUflj.EtGRKp2cCYYXHULr2fkykLAUnKnKcZ6', 'State_Admin', '06', NULL, true, false, 0, '6565656565', 'bhghgfh', 'chghgf', NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f76-8318-e063-e212000a345a', 'vsk.jh@rvsk.gov.in', 'VSK Jharkhand', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '20', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f63-8318-e063-e212000a345a', 'vsk.jk@rvsk.gov.in', 'VSK Jammu Kasmir', '$2a$12$9eWgVlmbEo2SoUhyPfGq6envxuuI7/FCTYijeHgRc1rZVXLoDhz7u', 'State_Admin', '01', NULL, true, false, 0, '9591518004', 'Nodal', 'Jammu RVSK', NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f7e-8318-e063-e212000a345a', 'vsk.ka@rvsk.gov.in', 'VSK Karnataka', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '28', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f81-8318-e063-e212000a345a', 'vsk.kl@rvsk.gov.in', 'VSK Kerala', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '31', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f86-8318-e063-e212000a345a', 'vsk.la@rvsk.gov.in', 'VSK Ladakh', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '36', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f80-8318-e063-e212000a345a', 'vsk.ld@rvsk.gov.in', 'VSK Lakshadweep', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '30', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f7c-8318-e063-e212000a345a', 'vsk.mh@rvsk.gov.in', 'VSK Maharashtra', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '26', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f73-8318-e063-e212000a345a', 'vsk.ml@rvsk.gov.in', 'VSK Meghalaya', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '17', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f70-8318-e063-e212000a345a', 'vsk.mn@rvsk.gov.in', 'VSK Manipur', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '14', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f79-8318-e063-e212000a345a', 'vsk.mp@rvsk.gov.in', 'VSK Madhya Pradesh', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '23', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f71-8318-e063-e212000a345a', 'vsk.mz@rvsk.gov.in', 'VSK Mizoram', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '15', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f6f-8318-e063-e212000a345a', 'vsk.nl@rvsk.gov.in', 'VSK Nagaland', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '13', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f77-8318-e063-e212000a345a', 'vsk.or@rvsk.gov.in', 'VSK Odisha', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '21', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f65-8318-e063-e212000a345a', 'vsk.pb@rvsk.gov.in', 'VSK Punjab', '$2a$12$iPEls3xNSngib.VVMea7v.FFJh18len/hrgIWRr3qnhytw.3slka.', 'State_Admin', '03', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f83-8318-e063-e212000a345a', 'vsk.py@rvsk.gov.in', 'VSK Puducherry', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '33', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f6a-8318-e063-e212000a345a', 'vsk.rj@rvsk.gov.in', 'VSK Rajasthan', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '08', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f6d-8318-e063-e212000a345a', 'vsk.sk@rvsk.gov.in', 'VSK Sikkim', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '11', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f82-8318-e063-e212000a345a', 'vsk.tn@rvsk.gov.in', 'VSK Tamil Nadu', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '32', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f72-8318-e063-e212000a345a', 'vsk.tr@rvsk.gov.in', 'VSK Tripura', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '16', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f85-8318-e063-e212000a345a', 'vsk.ts@rvsk.gov.in', 'VSK Telangana', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '35', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f67-8318-e063-e212000a345a', 'vsk.uk@rvsk.gov.in', 'VSK Uttarakhand', '$2a$12$Im6zPafEwfmpNkKI8zC8zuZ9glD3K4.l.Rs6mpfe8r3dAbJ/TJdtq', 'State_Admin', '05', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f6b-8318-e063-e212000a345a', 'vsk.up@rvsk.gov.in', 'VSK Uttar Pradesh', '$2a$12$WnLs3EzSUSp7hxi25f6dJuBnGAQMwQ4S5mP.piBJj7VQ1rDbVm1E6', 'State_Admin', '09', NULL, true, false, 0, '9591518004', 'Nodal UP', 'RSK', NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f75-8318-e063-e212000a345a', 'vsk.wb@rvsk.gov.in', 'VSK West Bengal', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'State_Admin', '19', NULL, true, true, 0, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('575e0a94-cc87-0f0a-e063-e212000a8842', 'admin@rvsk.gov.in', 'Super Admin', '$2b$12$94wP.Uvao5t6Ph1SozDH9.g/xwyRfS1uriamO80MO0W7EYUzoWIzu', 'Super_Admin', '50', NULL, true, false, 0, '9591518004', 'DIC', 'DIC', NULL, NULL, NULL, NOW(), NOW());
INSERT INTO portal_users (id, username, display_name, password_hash, role, state_code, district_code, is_active, is_first_login, failed_attempts, phone, designation, department, user_email, contact_email, mobile_number, created_at, updated_at)
VALUES ('577d0976-3f62-8318-e063-e212000a345a', 'viewer@rvsk.gov.in', 'Viewer User', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Viewer', '48', NULL, true, true, 2, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════
-- ROLE PAGE DEFAULTS V2
-- ═══════════════════════════════════════════════════════════════

INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6545-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64d1-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6546-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64d2-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6543-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64c2-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6542-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64c1-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6541-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64c0-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6540-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64bf-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-653f-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64be-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-653e-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64bd-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-653d-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64bc-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-653c-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64bb-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-653b-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64ba-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-653a-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64b9-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6539-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64b8-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6538-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64b7-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6537-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64b6-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6536-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64b5-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6535-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64b4-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6534-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64b3-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6533-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64b2-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6532-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64b1-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6531-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64b0-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6530-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64af-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6544-390f-e063-e212000a5960', 'Analytics_User', '585ac338-64c3-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-652e-390f-e063-e212000a5960', 'District_Admin', '585ac338-64d1-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-652d-390f-e063-e212000a5960', 'District_Admin', '585ac338-64ca-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-652c-390f-e063-e212000a5960', 'District_Admin', '585ac338-64c9-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-652b-390f-e063-e212000a5960', 'District_Admin', '585ac338-64bb-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-652f-390f-e063-e212000a5960', 'District_Admin', '585ac338-64d2-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6529-390f-e063-e212000a5960', 'District_Admin', '585ac338-64b1-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6528-390f-e063-e212000a5960', 'District_Admin', '585ac338-64b0-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6527-390f-e063-e212000a5960', 'District_Admin', '585ac338-64af-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-652a-390f-e063-e212000a5960', 'District_Admin', '585ac338-64b2-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6516-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64d2-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6515-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64d1-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6514-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64cd-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6513-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64cc-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6512-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64cb-390f-e063-e212000a5960', true, true, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6511-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64ca-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6510-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64c9-390f-e063-e212000a5960', true, true, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-650f-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64c7-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-650e-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64c6-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-650d-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64c5-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-650c-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64c4-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-650b-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64c3-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-650a-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64c2-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6509-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64c1-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6508-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64c0-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6507-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64bf-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6506-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64be-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6505-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64bd-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6504-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64bc-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6503-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64bb-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6502-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64ba-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6501-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64b9-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6500-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64b8-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64ff-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64b7-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64fe-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64b6-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64fd-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64b5-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64fc-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64b4-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64fb-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64b3-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64fa-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64b2-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64f9-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64b1-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64f7-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64af-390f-e063-e212000a5960', true, true, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64f8-390f-e063-e212000a5960', 'RVSK_Admin', '585ac338-64b0-390f-e063-e212000a5960', true, true, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-654d-390f-e063-e212000a5960', 'RVSK_SPOC', '585ac338-64af-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-654e-390f-e063-e212000a5960', 'RVSK_SPOC', '585ac338-64b0-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-654f-390f-e063-e212000a5960', 'RVSK_SPOC', '585ac338-64b1-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6550-390f-e063-e212000a5960', 'RVSK_SPOC', '585ac338-64b2-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6551-390f-e063-e212000a5960', 'RVSK_SPOC', '585ac338-64b3-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6552-390f-e063-e212000a5960', 'RVSK_SPOC', '585ac338-64bb-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6553-390f-e063-e212000a5960', 'RVSK_SPOC', '585ac338-64c9-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6554-390f-e063-e212000a5960', 'RVSK_SPOC', '585ac338-64ca-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6555-390f-e063-e212000a5960', 'RVSK_SPOC', '585ac338-64cb-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6556-390f-e063-e212000a5960', 'RVSK_SPOC', '585ac338-64d1-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6557-390f-e063-e212000a5960', 'RVSK_SPOC', '585ac338-64d2-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6548-390f-e063-e212000a5960', 'Read_Only_User', '585ac338-64b0-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6549-390f-e063-e212000a5960', 'Read_Only_User', '585ac338-64b1-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-654a-390f-e063-e212000a5960', 'Read_Only_User', '585ac338-64bb-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-654b-390f-e063-e212000a5960', 'Read_Only_User', '585ac338-64d1-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-654c-390f-e063-e212000a5960', 'Read_Only_User', '585ac338-64d2-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6547-390f-e063-e212000a5960', 'Read_Only_User', '585ac338-64af-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-651f-390f-e063-e212000a5960', 'State_Admin', '585ac338-64c3-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-651e-390f-e063-e212000a5960', 'State_Admin', '585ac338-64c1-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-651d-390f-e063-e212000a5960', 'State_Admin', '585ac338-64bc-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-651c-390f-e063-e212000a5960', 'State_Admin', '585ac338-64bb-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-651b-390f-e063-e212000a5960', 'State_Admin', '585ac338-64b3-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-651a-390f-e063-e212000a5960', 'State_Admin', '585ac338-64b2-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6519-390f-e063-e212000a5960', 'State_Admin', '585ac338-64b1-390f-e063-e212000a5960', true, false, true, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6518-390f-e063-e212000a5960', 'State_Admin', '585ac338-64b0-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6517-390f-e063-e212000a5960', 'State_Admin', '585ac338-64af-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6520-390f-e063-e212000a5960', 'State_Admin', '585ac338-64c4-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6522-390f-e063-e212000a5960', 'State_Admin', '585ac338-64c9-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6523-390f-e063-e212000a5960', 'State_Admin', '585ac338-64ca-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6524-390f-e063-e212000a5960', 'State_Admin', '585ac338-64cb-390f-e063-e212000a5960', true, false, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6525-390f-e063-e212000a5960', 'State_Admin', '585ac338-64d1-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6526-390f-e063-e212000a5960', 'State_Admin', '585ac338-64d2-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-6521-390f-e063-e212000a5960', 'State_Admin', '585ac338-64c8-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64ea-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64c6-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64eb-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64c7-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64ec-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64c8-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64ed-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64c9-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64ee-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64ca-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64ef-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64cb-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64f0-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64cc-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64f1-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64cd-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64f2-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64ce-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64f3-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64cf-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64f4-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64d0-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64f5-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64d1-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64f6-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64d2-390f-e063-e212000a5960', true, true, false, false, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64e9-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64c5-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64e8-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64c4-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64e7-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64c3-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64e6-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64c2-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64e5-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64c1-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64e4-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64c0-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64e3-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64bf-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64e2-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64be-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64e1-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64bd-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64e0-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64bc-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64df-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64bb-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64de-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64ba-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64dd-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64b9-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64dc-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64b8-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64db-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64b7-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64da-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64b6-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64d9-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64b5-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64d8-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64b4-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64d7-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64b3-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64d6-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64b2-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64d5-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64b1-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64d3-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64af-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());
INSERT INTO role_page_defaults_v2 (id, role, page_id, can_view, can_edit, can_export, can_delete, created_at, updated_at)
VALUES ('585ac338-64d4-390f-e063-e212000a5960', 'Super_Admin', '585ac338-64b0-390f-e063-e212000a5960', true, true, true, true, NOW(), NOW());

-- ═══════════════════════════════════════════════════════════════
-- GRIEVANCE CATEGORIES
-- ═══════════════════════════════════════════════════════════════

-- Temporarily disable FK check for self-referencing parent_code
ALTER TABLE grievance_categories DROP CONSTRAINT IF EXISTS grievance_categories_parent_code_fkey;

INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('INFRA', 'Infrastructure Issues', NULL, 1, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('INFRA_BUILDING', 'Building Maintenance', 'INFRA', 1, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('STAFF_ABSENCE', 'Staff Absence', 'STAFF', 1, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('SERVICE_DELAY', 'Service Delay', 'SERVICE', 1, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('TECH_PORTAL', 'Portal Issues', 'TECHNICAL', 1, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('DATA_QUALITY', 'Data Quality Issues', 'DATA', 1, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('FIN_PAYMENT', 'Payment Delay', 'FINANCE', 1, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('OTHER_GENERAL', 'General Query', 'OTHER', 1, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('INFRASTRUCTURE', 'Infrastructure', NULL, 1, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('SW_LMS', 'Learning Management System', 'SOFTWARE', 1, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('TRAIN_SCHEDULE', 'Training Schedule', 'TRAINING', 1, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('STAFF', 'Staff Related', NULL, 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('INFRA_EQUIPMENT', 'Equipment ', 'INFRA', 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('STAFF_BEHAVIOUR', 'Staff Behaviour', 'STAFF', 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('SERVICE_QUALITY', 'Service Quality', 'SERVICE', 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('TECH_NETWORK', 'Network Connectivity', 'TECHNICAL', 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('TRAIN_MATERIAL', 'Training Material', 'TRAINING', 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('DATA_ACCESS', 'Data Access Issues', 'DATA', 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('OTHER_SUGGESTION', 'Suggestions', 'OTHER', 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('INFRA_NETWORK', 'Network/Internet', 'INFRASTRUCTURE', 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('SOFTWARE', 'Software a', NULL, 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('SW_PORTAL', 'Portal Issues', 'SOFTWARE', 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('TRAIN_CONTENT', 'Training Content', 'TRAINING', 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('FIN_REIMBURSEMENT', 'Reimbursement Issues', 'FINANCE', 2, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('SERVICE', 'Service Delivery', NULL, 3, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('INFRA_POWER', 'Power ', 'INFRA', 3, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('STAFF_SHORTAGE', 'Staff Shortage', 'STAFF', 3, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('FIN_BUDGET', 'Budget Allocation', 'FINANCE', 3, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('TECH_SOFTWARE', 'Software Problems', 'TECHNICAL', 3, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('TRAIN_CERT', 'Certification Issues', 'TRAINING', 3, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('SERVICE_DENIAL', 'Service Denial', 'SERVICE', 3, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('TECHNICAL', 'Technical Issues', NULL, 4, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('INFRA_WATER', 'Water ', 'INFRA', 4, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('TECH_DATA', 'Data Discrepancy', 'TECHNICAL', 4, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('SERVICE_ACCESS', 'Accessibility Issues', 'SERVICE', 4, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('DATA', 'Data a', NULL, 4, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('STAFF_TRANSFER', 'Transfer Issues', 'STAFF', 4, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('TRAINING', 'Training ', NULL, 5, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('FINANCE', 'Financial Matters', NULL, 6, true);
INSERT INTO grievance_categories (code, label, parent_code, sort_order, is_active)
VALUES ('OTHER', 'Other', NULL, 7, true);

-- Re-add FK constraint for grievance_categories
ALTER TABLE grievance_categories ADD CONSTRAINT grievance_categories_parent_code_fkey
  FOREIGN KEY (parent_code) REFERENCES grievance_categories(code);

-- Done!

-- ============================================================
-- RVSK Portal — Accreditation Dashboard RBAC Page Registration
-- Registers 5 section pages under the existing ACCREDITATION module
-- Module ID: 585ac338-64a9-390f-e063-e212000a5960
--
-- Pages:
--   1. ACCR_PROGRAMME   — Programme & Framework
--   2. ACCR_COVERAGE    — Coverage & Reach
--   3. ACCR_PROCESS     — Process & Operations
--   4. ACCR_DATA_QUALITY — Data Quality
--   5. ACCR_IMPACT      — Impact & Outcomes
--
-- Requirements: 12.1, 12.2, 12.3, 12.4
-- ============================================================

SET search_path TO rvsk_portal;

INSERT INTO page_master (id, module_id, page_code, page_name, route_path, icon, display_order, is_active, created_at, updated_at)
VALUES
  ('585ac338-64c3-390f-e063-e212000a5960', '585ac338-64a9-390f-e063-e212000a5960',
   'ACCR_PROGRAMME', 'Programme & Framework', '/rvsk/dashboard/accreditation/programme', 'AccountTree', 1, true, NOW(), NOW()),
  ('a1b2c3d4-0002-4000-8000-000000000002', '585ac338-64a9-390f-e063-e212000a5960',
   'ACCR_COVERAGE', 'Coverage & Reach', '/rvsk/dashboard/accreditation/coverage', 'PieChart', 2, true, NOW(), NOW()),
  ('a1b2c3d4-0003-4000-8000-000000000003', '585ac338-64a9-390f-e063-e212000a5960',
   'ACCR_PROCESS', 'Process & Operations', '/rvsk/dashboard/accreditation/process', 'Engineering', 3, true, NOW(), NOW()),
  ('a1b2c3d4-0004-4000-8000-000000000004', '585ac338-64a9-390f-e063-e212000a5960',
   'ACCR_DATA_QUALITY', 'Data Quality', '/rvsk/dashboard/accreditation/data-quality', 'FactCheck', 4, true, NOW(), NOW()),
  ('a1b2c3d4-0005-4000-8000-000000000005', '585ac338-64a9-390f-e063-e212000a5960',
   'ACCR_IMPACT', 'Impact & Outcomes', '/rvsk/dashboard/accreditation/impact', 'TrendingUp', 5, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

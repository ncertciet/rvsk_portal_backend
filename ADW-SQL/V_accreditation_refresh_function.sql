-- ============================================================
-- RVSK Portal — Accreditation Dashboard MV Refresh Function
-- Schema: accreditation
-- Purpose: Refreshes all 6 dashboard materialized views concurrently
--          to avoid blocking read operations during refresh.
--
-- Requirements: 10.2, 10.3, 17.3
--
-- Usage:
--   SELECT accreditation.refresh_dashboard_views();
--
-- Notes:
--   - Uses REFRESH MATERIALIZED VIEW CONCURRENTLY which requires
--     a UNIQUE INDEX on each MV (already created in V_accreditation_dashboard_mvs.sql)
--   - SECURITY DEFINER allows the app role to invoke this function
--     even if it lacks direct ownership of the materialized views
--   - Concurrent refresh allows ongoing SELECT queries to continue
--     reading the old MV data until each refresh completes
-- ============================================================

CREATE OR REPLACE PROCEDURE RTIWARI.refresh_dashboard_views
AUTHID DEFINER
AS
BEGIN

    -- Section 01: Programme Infrastructure & Framework
    -- KPI 1, 2, 3, 7, 10
    DBMS_MVIEW.REFRESH(
        'RTIWARI.MV_DASH_PROGRAMME_FRAMEWORK',
        'F'
    );

    -- Section 02: Coverage & Reach
    -- KPI 4, 5, 6
    DBMS_MVIEW.REFRESH(
        'RTIWARI.MV_DASH_COVERAGE_REACH',
        'F'
    );

    -- Section 03: Process Quality & Operations
    -- KPI 7, 8, 9
    DBMS_MVIEW.REFRESH(
        'RTIWARI.MV_DASH_PROCESS_OPERATIONS',
        'F'
    );

    -- Section 03b: Domain Components
    -- KPI 11, 12
    DBMS_MVIEW.REFRESH(
        'RTIWARI.MV_DASH_DOMAIN_COMPONENTS',
        'F'
    );

    -- Section 04: Data Quality & Compliance
    -- KPI 13, 14
    DBMS_MVIEW.REFRESH(
        'RTIWARI.MV_DASH_DATA_QUALITY',
        'F'
    );

    -- Section 05: Impact / Outcomes & Decision-Making
    -- KPI 15, 16, 17
    DBMS_MVIEW.REFRESH(
        'RTIWARI.MV_DASH_IMPACT_OUTCOMES',
        'F'
    );

END;
/

GRANT EXECUTE ON RTIWARI.refresh_dashboard_views TO RTIWARI;

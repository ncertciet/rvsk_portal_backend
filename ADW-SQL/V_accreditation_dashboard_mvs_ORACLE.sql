-- ============================================================
-- RVSK Portal — Accreditation Dashboard Materialized Views (ORACLE / ADW)
-- Target: Oracle ADW test environment
-- Ported from the PostgreSQL spec DDL (V_accreditation_dashboard_mvs.sql)
--
-- IMPORTANT NOTES / DIALECT DIFFERENCES FROM POSTGRES:
--   1. No "REFRESH CONCURRENTLY" in Oracle. These are built as
--      REFRESH COMPLETE ON DEMAND. Refresh via DBMS_MVIEW.REFRESH or the
--      refresh procedure (see V_accreditation_refresh_function_ORACLE.sql).
--   2. Postgres "COUNT(*) FILTER (WHERE x)" -> "COUNT(CASE WHEN x THEN 1 END)".
--   3. Postgres booleans (is_active = true) -> Oracle has no BOOLEAN in SQL.
--      Assumed IS_ACTIVE is NUMBER(1) with 1 = active. ADJUST if it is CHAR('Y').
--   4. "DISTINCT ON (col ORDER BY ...)" -> ROW_NUMBER() OVER (PARTITION BY ...).
--   5. "::numeric" casts -> handled implicitly / via CAST where needed.
--   6. ROUND / NULLIF / WITH (CTE) / LAG() OVER () are all valid in Oracle.
--   7. Unique indexes are NOT required (that was only for Postgres CONCURRENTLY),
--      but we keep them for query performance and to support FAST refresh later.
--
-- ⚠️ COLUMN-NAME ASSUMPTIONS — PLEASE CONFIRM against the real ADW tables.
--    Every table below is annotated with the columns this DDL relies on.
--    Where I am unsure, it is marked "CONFIRM:". Tell me the actual names
--    and I will correct them.
--
-- SCHEMA: replace &ACCR_SCHEMA with the real ADW schema (e.g. RTIWARI / WKSP_VSKDEV).
-- ============================================================

-- Tables referenced (flat tables — will exist natively in ADW, not flattened):
--   ACCREDITATION_FRAMEWORK (STATE_CODE, ACADEMIC_YEAR, FRAMEWORK_ID, FRAMEWORK_NAME,
--        IS_ACTIVE, SCHOOL_STANDARD_AUTHORITY, SCHOOL_STANDARD_AUTHORITY_NAME,
--        INTEGRATION_OF_VSK, FREQUENCY_OF_SCHOOL_ACCREDITATION, SHARING_OF_RESULT,
--        TARGET_COMPLETION_DATE, STATE_LEVEL_DECISION_USE_CASES)
--   SCHOOL_ASSESSMENT (STATE_CODE, ACADEMIC_YEAR, UDISE_CODE, FRAMEWORK_ID,
--        ASSESSMENT_ID, ASSESSMENT_DATE, ACCREDITATION_ROUND, ACCREDITATION_MODEL_USED,
--        CREATED_DATE, and flat authority counts:
--        STATE_OFFICIAL, DISTRICT_OFFICIAL, BLOCK_OFFICIAL, CLUSTER_OFFICIAL,
--        COMMUNITY_MEMBERS, THIRD_PARTY_AUDITORS)   -- CONFIRM these exist flat in ADW
--   SCHOOL_MASTER (UDISE_CODE, STATE_CODE, IS_ACTIVE)
--   STATE_MASTER (STATE_CODE, STATE_NAME)  -- used by service meta/states
--   DOMAIN_ASSESSMENT_FLAT (TEMP_KEY, UDISE_CODE, STATE_CODE, ACADEMIC_YEAR,
--        DOMAIN_CODE, SUB_DOMAIN_CODE, SCORE, STATUS, DW_LOAD_TS)
--   FRAMEWORK_DOMAIN (DOMAIN_PK, FRAMEWORK_ID, DOMAIN_CODE, DOMAIN_NAME, DOMAIN_WEIGHTAGE)
--   FRAMEWORK_SUBDOMAIN (SUBDOMAIN_PK, DOMAIN_PK, SUB_DOMAIN_CODE, SUBDOMAIN_WEIGHTAGE)
--   LOOKUP_MASTER (CATEGORY, CODE, LABEL)


-- ═══════════════════════════════════════════════════════════════
-- MV 1: Programme Infrastructure & Framework (KPI 1, 2, 3, 7, 10)
-- ═══════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW &ACCR_SCHEMA.MV_DASH_PROGRAMME_FRAMEWORK
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
AS
SELECT
    f.state_code,
    f.academic_year,
    f.framework_id,
    f.framework_name,
    f.is_active                                AS programme_active,
    f.school_standard_authority,
    f.school_standard_authority_name,
    f.integration_of_vsk,
    lm_freq.label                              AS accreditation_frequency,
    lm_share.label                             AS sharing_of_result_label,
    lm_model.label                             AS accreditation_model_label,
    COUNT(DISTINCT CASE WHEN sa.accreditation_model_used IS NOT NULL
                        THEN sa.udise_code END) AS schools_on_this_model
FROM &ACCR_SCHEMA.accreditation_framework f
LEFT JOIN &ACCR_SCHEMA.lookup_master lm_freq
       ON lm_freq.category = 'ACCREDITATION_FREQUENCY' AND lm_freq.code = f.frequency_of_school_accreditation
LEFT JOIN &ACCR_SCHEMA.lookup_master lm_share
       ON lm_share.category = 'SHARING_OF_RESULT' AND lm_share.code = f.sharing_of_result
LEFT JOIN &ACCR_SCHEMA.school_assessment sa
       ON sa.framework_id = f.framework_id AND sa.state_code = f.state_code
LEFT JOIN &ACCR_SCHEMA.lookup_master lm_model
       ON lm_model.category = 'ACCREDITATION_MODEL' AND lm_model.code = sa.accreditation_model_used
WHERE f.is_active = 1                          -- CONFIRM: NUMBER(1). If CHAR, use = 'Y'
GROUP BY f.state_code, f.academic_year, f.framework_id, f.framework_name, f.is_active,
         f.school_standard_authority, f.school_standard_authority_name, f.integration_of_vsk,
         lm_freq.label, lm_share.label, lm_model.label;

CREATE UNIQUE INDEX &ACCR_SCHEMA.UX_MV_PROGRAMME_FRAMEWORK
    ON &ACCR_SCHEMA.MV_DASH_PROGRAMME_FRAMEWORK (state_code, academic_year, framework_id, accreditation_model_label);


-- ═══════════════════════════════════════════════════════════════
-- MV 2: Coverage & Reach (KPI 4, 5, 6)
-- ═══════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW &ACCR_SCHEMA.MV_DASH_COVERAGE_REACH
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
AS
WITH school_agg AS (
    SELECT
        sa.state_code, sa.academic_year,
        COUNT(DISTINCT sa.udise_code)                                             AS schools_accredited,
        COUNT(DISTINCT CASE WHEN sa.accreditation_round = 1  THEN sa.udise_code END) AS round_1,
        COUNT(DISTINCT CASE WHEN sa.accreditation_round = 2  THEN sa.udise_code END) AS round_2,
        COUNT(DISTINCT CASE WHEN sa.accreditation_round >= 3 THEN sa.udise_code END) AS round_3_plus,
        ROUND(AVG(sa.accreditation_round), 2)                                     AS avg_rounds_per_school
    FROM &ACCR_SCHEMA.school_assessment sa
    GROUP BY sa.state_code, sa.academic_year
),
total_schools AS (
    SELECT state_code, COUNT(*) AS total_schools
    FROM &ACCR_SCHEMA.school_master
    WHERE is_active = 1                        -- CONFIRM boolean representation
    GROUP BY state_code
)
SELECT
    s.state_code, s.academic_year, s.schools_accredited, ts.total_schools,
    ROUND((s.schools_accredited / NULLIF(ts.total_schools, 0)) * 100, 1) AS coverage_pct,
    CASE
        WHEN (s.schools_accredited / NULLIF(ts.total_schools, 0)) * 100 > 60 THEN 'HIGH'
        WHEN (s.schools_accredited / NULLIF(ts.total_schools, 0)) * 100 >= 40 THEN 'MEDIUM'
        ELSE 'LOW'
    END AS coverage_tier,
    s.round_1, s.round_2, s.round_3_plus, s.avg_rounds_per_school
FROM school_agg s
LEFT JOIN total_schools ts ON ts.state_code = s.state_code;

CREATE UNIQUE INDEX &ACCR_SCHEMA.UX_MV_COVERAGE_REACH
    ON &ACCR_SCHEMA.MV_DASH_COVERAGE_REACH (state_code, academic_year);


-- ═══════════════════════════════════════════════════════════════
-- MV 3: Process Quality & Operations (KPI 7, 8, 9)
-- Relies on FLAT authority-count columns on SCHOOL_ASSESSMENT.
-- CONFIRM these 6 columns exist in ADW (STATE_OFFICIAL ... THIRD_PARTY_AUDITORS).
-- ═══════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW &ACCR_SCHEMA.MV_DASH_PROCESS_OPERATIONS
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
AS
WITH visits AS (
    SELECT
        sa.state_code, sa.academic_year, sa.udise_code,
        CASE WHEN (sa.state_official + sa.district_official + sa.block_official
                   + sa.cluster_official + sa.community_members + sa.third_party_auditors) > 0
             THEN 1 ELSE 0 END AS visit_conducted,
        sa.state_official, sa.district_official, sa.block_official,
        sa.cluster_official, sa.community_members, sa.third_party_auditors
    FROM &ACCR_SCHEMA.school_assessment sa
)
SELECT
    v.state_code, v.academic_year,
    COUNT(DISTINCT v.udise_code)                                                   AS total_accredited_schools,
    COUNT(DISTINCT CASE WHEN v.visit_conducted = 1 THEN v.udise_code END)          AS visited_schools,
    ROUND(COUNT(DISTINCT CASE WHEN v.visit_conducted = 1 THEN v.udise_code END)
          / NULLIF(COUNT(DISTINCT v.udise_code), 0) * 100, 1)                       AS visit_coverage_pct,
    ROUND(COUNT(CASE WHEN v.state_official       > 0 THEN 1 END) / NULLIF(COUNT(CASE WHEN v.visit_conducted = 1 THEN 1 END), 0) * 100, 1) AS pct_state_official,
    ROUND(COUNT(CASE WHEN v.district_official    > 0 THEN 1 END) / NULLIF(COUNT(CASE WHEN v.visit_conducted = 1 THEN 1 END), 0) * 100, 1) AS pct_district_official,
    ROUND(COUNT(CASE WHEN v.block_official       > 0 THEN 1 END) / NULLIF(COUNT(CASE WHEN v.visit_conducted = 1 THEN 1 END), 0) * 100, 1) AS pct_block_official,
    ROUND(COUNT(CASE WHEN v.cluster_official     > 0 THEN 1 END) / NULLIF(COUNT(CASE WHEN v.visit_conducted = 1 THEN 1 END), 0) * 100, 1) AS pct_cluster_official,
    ROUND(COUNT(CASE WHEN v.community_members    > 0 THEN 1 END) / NULLIF(COUNT(CASE WHEN v.visit_conducted = 1 THEN 1 END), 0) * 100, 1) AS pct_community_members,
    ROUND(COUNT(CASE WHEN v.third_party_auditors > 0 THEN 1 END) / NULLIF(COUNT(CASE WHEN v.visit_conducted = 1 THEN 1 END), 0) * 100, 1) AS pct_third_party_auditors
FROM visits v
GROUP BY v.state_code, v.academic_year;

CREATE UNIQUE INDEX &ACCR_SCHEMA.UX_MV_PROCESS_OPERATIONS
    ON &ACCR_SCHEMA.MV_DASH_PROCESS_OPERATIONS (state_code, academic_year);


-- ═══════════════════════════════════════════════════════════════
-- MV 4: Domain Components (KPI 11, 12)
-- Uses latest assessment per school (ROW_NUMBER instead of DISTINCT ON).
-- Two-level weighted score rollup happens in the domain_scored CTE.
-- ═══════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW &ACCR_SCHEMA.MV_DASH_DOMAIN_COMPONENTS
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
AS
-- NOTE ON JOIN KEY:
--   SCHOOL_ASSESSMENT uses an upsert model — a school (UDISE_CODE) can have
--   MULTIPLE rows, one per assessment event (a new row is inserted when the
--   assessment_date changes). Each assessment event carries a unique
--   DOMAIN_ASSESSMENT_KEY, and its domain/sub-domain scores in
--   DOMAIN_ASSESSMENT_FLAT carry the SAME key. So we join on
--   DOMAIN_ASSESSMENT_KEY (per-assessment), NOT on udise_code (per-school)
--   and NOT on the old TEMP_KEY/ASSESSMENT_ID pairing.
WITH latest_ranked AS (
    SELECT domain_assessment_key, udise_code, state_code, academic_year, framework_id,
           ROW_NUMBER() OVER (PARTITION BY udise_code ORDER BY assessment_date DESC) AS rn
    FROM &ACCR_SCHEMA.school_assessment
),
latest_assessment AS (
    SELECT domain_assessment_key, udise_code, state_code, academic_year, framework_id
    FROM latest_ranked
    WHERE rn = 1
),
subdomain_scored AS (
    SELECT
        la.state_code, la.academic_year, daf.udise_code, daf.domain_code, daf.sub_domain_code, daf.score,
        fd.domain_pk, fd.domain_name, fd.domain_weightage, fsd.subdomain_weightage
    FROM &ACCR_SCHEMA.domain_assessment_flat daf
    JOIN latest_assessment la ON la.domain_assessment_key = daf.domain_assessment_key
    JOIN &ACCR_SCHEMA.framework_domain fd
         ON fd.framework_id = la.framework_id AND fd.domain_code = daf.domain_code
    JOIN &ACCR_SCHEMA.framework_subdomain fsd
         ON fsd.domain_pk = fd.domain_pk AND fsd.sub_domain_code = daf.sub_domain_code
    WHERE daf.status = 'ACTIVE'
),
domain_scored AS (
    SELECT
        state_code, academic_year, udise_code, domain_code, domain_name, domain_weightage,
        SUM(score * subdomain_weightage) / NULLIF(SUM(subdomain_weightage), 0) AS domain_score
    FROM subdomain_scored
    GROUP BY state_code, academic_year, udise_code, domain_code, domain_name, domain_weightage
)
SELECT
    academic_year, domain_code, domain_name,
    ROUND(AVG(domain_weightage), 2)   AS domain_weightage,
    COUNT(DISTINCT state_code)         AS states_assessing,
    ROUND(AVG(domain_score), 1)        AS avg_score
FROM domain_scored
GROUP BY academic_year, domain_code, domain_name;

CREATE UNIQUE INDEX &ACCR_SCHEMA.UX_MV_DOMAIN_COMPONENTS
    ON &ACCR_SCHEMA.MV_DASH_DOMAIN_COMPONENTS (academic_year, domain_code);


-- ═══════════════════════════════════════════════════════════════
-- MV 5: Data Quality & Compliance (KPI 13, 14)
-- Delayed = 1..14 days late; Significantly delayed = >14 days late.
-- CONFIRM: SCHOOL_ASSESSMENT.CREATED_DATE is the submission timestamp,
--          ACCREDITATION_FRAMEWORK.TARGET_COMPLETION_DATE is the deadline.
-- Oracle date subtraction yields days (a NUMBER), matching the Postgres logic.
-- ═══════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW &ACCR_SCHEMA.MV_DASH_DATA_QUALITY
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
AS
WITH submissions AS (
    SELECT
        sa.state_code, sa.academic_year, sa.udise_code,
        TRUNC(sa.created_date)                                   AS submitted_date,
        f.target_completion_date,
        (TRUNC(f.target_completion_date) - TRUNC(sa.created_date)) AS days_before_deadline
    FROM &ACCR_SCHEMA.school_assessment sa
    JOIN &ACCR_SCHEMA.accreditation_framework f ON f.framework_id = sa.framework_id
),
total_schools AS (
    SELECT state_code, COUNT(*) AS total_schools
    FROM &ACCR_SCHEMA.school_master
    WHERE is_active = 1                        -- CONFIRM boolean representation
    GROUP BY state_code
)
SELECT
    s.state_code, s.academic_year,
    COUNT(DISTINCT s.udise_code)                                                       AS schools_submitted,
    ts.total_schools,
    ROUND(COUNT(DISTINCT s.udise_code) / NULLIF(ts.total_schools, 0) * 100, 1)          AS self_disclosure_pct,
    ROUND(COUNT(CASE WHEN days_before_deadline >= 0 THEN 1 END)              / COUNT(*) * 100, 1) AS on_time_pct,
    ROUND(COUNT(CASE WHEN days_before_deadline BETWEEN -14 AND -1 THEN 1 END) / COUNT(*) * 100, 1) AS delayed_pct,
    ROUND(COUNT(CASE WHEN days_before_deadline < -14 THEN 1 END)             / COUNT(*) * 100, 1) AS significantly_delayed_pct,
    ROUND(AVG(CASE WHEN days_before_deadline < 0 THEN ABS(days_before_deadline) END), 1)          AS avg_delay_days
FROM submissions s
LEFT JOIN total_schools ts ON ts.state_code = s.state_code
GROUP BY s.state_code, s.academic_year, ts.total_schools;

CREATE UNIQUE INDEX &ACCR_SCHEMA.UX_MV_DATA_QUALITY
    ON &ACCR_SCHEMA.MV_DASH_DATA_QUALITY (state_code, academic_year);


-- ═══════════════════════════════════════════════════════════════
-- MV 6: Impact/Outcomes & Decision-Making (KPI 15, 16, 17)
-- Trend via LAG() over prior assessment for each school.
-- ═══════════════════════════════════════════════════════════════
CREATE MATERIALIZED VIEW &ACCR_SCHEMA.MV_DASH_IMPACT_OUTCOMES
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND
AS
-- NOTE ON JOIN KEY:
--   Same upsert model as MV4. Each assessment event (row in SCHOOL_ASSESSMENT)
--   has a unique DOMAIN_ASSESSMENT_KEY shared with its DOMAIN_ASSESSMENT_FLAT
--   score rows. We join and group by DOMAIN_ASSESSMENT_KEY so each event's
--   overall score is computed only from its own scores; LAG() over
--   assessment_date then compares consecutive DISTINCT events per school.
WITH subdomain_scored AS (
    SELECT
        sa.domain_assessment_key, sa.udise_code, sa.state_code, sa.academic_year, sa.assessment_date,
        daf.domain_code, daf.sub_domain_code, daf.score,
        fd.domain_pk, fd.domain_weightage, fsd.subdomain_weightage
    FROM &ACCR_SCHEMA.domain_assessment_flat daf
    JOIN &ACCR_SCHEMA.school_assessment sa ON sa.domain_assessment_key = daf.domain_assessment_key
    JOIN &ACCR_SCHEMA.framework_domain fd
         ON fd.framework_id = sa.framework_id AND fd.domain_code = daf.domain_code
    JOIN &ACCR_SCHEMA.framework_subdomain fsd
         ON fsd.domain_pk = fd.domain_pk AND fsd.sub_domain_code = daf.sub_domain_code
    WHERE daf.status = 'ACTIVE'
),
domain_scored AS (
    SELECT domain_assessment_key, udise_code, state_code, academic_year, assessment_date, domain_code, domain_weightage,
           SUM(score * subdomain_weightage) / NULLIF(SUM(subdomain_weightage), 0) AS domain_score
    FROM subdomain_scored
    GROUP BY domain_assessment_key, udise_code, state_code, academic_year, assessment_date, domain_code, domain_weightage
),
assessment_overall AS (
    SELECT domain_assessment_key, udise_code, state_code, academic_year, assessment_date,
           SUM(domain_score * domain_weightage) / NULLIF(SUM(domain_weightage), 0) AS overall_score
    FROM domain_scored
    GROUP BY domain_assessment_key, udise_code, state_code, academic_year, assessment_date
),
ranked AS (
    SELECT ao.*,
        LAG(overall_score) OVER (PARTITION BY udise_code ORDER BY assessment_date) AS prev_overall_score
    FROM assessment_overall ao
),
trend AS (
    SELECT
        state_code, academic_year,
        COUNT(CASE WHEN prev_overall_score IS NOT NULL THEN 1 END)                     AS schools_with_prior_assessment,
        COUNT(CASE WHEN overall_score > prev_overall_score THEN 1 END)                 AS schools_improved,
        ROUND(AVG(CASE WHEN prev_overall_score IS NOT NULL
                       THEN overall_score - prev_overall_score END), 1)                AS avg_score_change
    FROM ranked
    GROUP BY state_code, academic_year
)
SELECT
    f.state_code, f.academic_year,
    lm_share.label                                                    AS sharing_of_result_label,
    f.state_level_decision_use_cases,
    t.schools_improved, t.schools_with_prior_assessment,
    ROUND(t.schools_improved / NULLIF(t.schools_with_prior_assessment, 0) * 100, 1) AS pct_schools_improved,
    t.avg_score_change
FROM &ACCR_SCHEMA.accreditation_framework f
LEFT JOIN &ACCR_SCHEMA.lookup_master lm_share
       ON lm_share.category = 'SHARING_OF_RESULT' AND lm_share.code = f.sharing_of_result
LEFT JOIN trend t ON t.state_code = f.state_code AND t.academic_year = f.academic_year
WHERE f.is_active = 1;                         -- CONFIRM boolean representation

CREATE UNIQUE INDEX &ACCR_SCHEMA.UX_MV_IMPACT_OUTCOMES
    ON &ACCR_SCHEMA.MV_DASH_IMPACT_OUTCOMES (state_code, academic_year);

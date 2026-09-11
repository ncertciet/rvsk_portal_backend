-- ============================================================
-- RVSK Portal — Accreditation Dashboard Materialized Views
-- Schema: accreditation
-- Purpose: Pre-aggregated KPI data for the Accreditation Dashboard
--          (KPIs 1–17, across 5 sections)
--
-- Requirements: 13.3, 4.4, 5.6, 6.5, 6.6, 7.3, 8.6
--
-- Each MV has a UNIQUE INDEX to support REFRESH CONCURRENTLY.
-- All dashboard reads come exclusively from these views —
-- never from live fact tables.
-- ============================================================

SET search_path TO accreditation;

-- Supporting index for score rollup joins (temp_key linkage)
CREATE INDEX IF NOT EXISTS ix_daf_temp_key
    ON accreditation.domain_assessment_flat (temp_key);

-- ═══════════════════════════════════════════════════════════════
-- MV 1: Programme Infrastructure & Framework (KPI 1, 2, 3, 7, 10)
-- Aggregates state-level programme/framework data including:
--   - Active programmes (KPI 1)
--   - School standard authorities (KPI 2)
--   - Accreditation models (KPI 3)
--   - VSK integration (KPI 10)
--   - Frequency (KPI 7)
--   - Result sharing (KPI 17 supplement)
-- ═══════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW accreditation.mv_dash_programme_framework AS
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
    COUNT(DISTINCT sa.udise_code) FILTER (WHERE sa.accreditation_model_used IS NOT NULL) AS schools_on_this_model
FROM accreditation.accreditation_framework f
LEFT JOIN accreditation.lookup_master lm_freq
       ON lm_freq.category = 'ACCREDITATION_FREQUENCY' AND lm_freq.code = f.frequency_of_school_accreditation
LEFT JOIN accreditation.lookup_master lm_share
       ON lm_share.category = 'SHARING_OF_RESULT' AND lm_share.code = f.sharing_of_result
LEFT JOIN accreditation.school_assessment sa
       ON sa.framework_id = f.framework_id AND sa.state_code = f.state_code
LEFT JOIN accreditation.lookup_master lm_model
       ON lm_model.category = 'ACCREDITATION_MODEL' AND lm_model.code = sa.accreditation_model_used
WHERE f.is_active = true
GROUP BY f.state_code, f.academic_year, f.framework_id, f.framework_name, f.is_active,
         f.school_standard_authority, f.school_standard_authority_name, f.integration_of_vsk,
         lm_freq.label, lm_share.label, lm_model.label;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX ux_mv_programme_framework
    ON accreditation.mv_dash_programme_framework (state_code, academic_year, framework_id, accreditation_model_label);


-- ═══════════════════════════════════════════════════════════════
-- MV 2: Coverage & Reach (KPI 4, 5, 6)
-- Aggregates coverage data per state:
--   - Schools accredited (KPI 4)
--   - Round distribution: round_1, round_2, round_3_plus (KPI 5)
--   - Average rounds per school (KPI 5)
--   - Coverage percentage and tier classification (KPI 6)
--     HIGH (>60%), MEDIUM (40–60%), LOW (<40% or total_schools=0)
-- ═══════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW accreditation.mv_dash_coverage_reach AS
WITH school_agg AS (
    SELECT
        sa.state_code, sa.academic_year,
        COUNT(DISTINCT sa.udise_code)                                              AS schools_accredited,
        COUNT(DISTINCT sa.udise_code) FILTER (WHERE sa.accreditation_round = 1)     AS round_1,
        COUNT(DISTINCT sa.udise_code) FILTER (WHERE sa.accreditation_round = 2)     AS round_2,
        COUNT(DISTINCT sa.udise_code) FILTER (WHERE sa.accreditation_round >= 3)    AS round_3_plus,
        ROUND(AVG(sa.accreditation_round)::numeric, 2)                             AS avg_rounds_per_school
    FROM accreditation.school_assessment sa
    GROUP BY sa.state_code, sa.academic_year
),
total_schools AS (
    SELECT state_code, COUNT(*) AS total_schools
    FROM accreditation.school_master WHERE is_active = true
    GROUP BY state_code
)
SELECT
    s.state_code, s.academic_year, s.schools_accredited, ts.total_schools,
    ROUND((s.schools_accredited::numeric / NULLIF(ts.total_schools, 0)) * 100, 1) AS coverage_pct,
    CASE
        WHEN (s.schools_accredited::numeric / NULLIF(ts.total_schools, 0)) * 100 > 60 THEN 'HIGH'
        WHEN (s.schools_accredited::numeric / NULLIF(ts.total_schools, 0)) * 100 >= 40 THEN 'MEDIUM'
        ELSE 'LOW'
    END AS coverage_tier,
    s.round_1, s.round_2, s.round_3_plus, s.avg_rounds_per_school
FROM school_agg s
LEFT JOIN total_schools ts ON ts.state_code = s.state_code;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX ux_mv_coverage_reach
    ON accreditation.mv_dash_coverage_reach (state_code, academic_year);


-- ═══════════════════════════════════════════════════════════════
-- MV 3: Process Quality & Operations (KPI 7, 8, 9)
-- Aggregates process quality per state:
--   - Total accredited schools and visited schools (KPI 8)
--   - Visit coverage percentage (KPI 8)
--   - Authority participation percentages for 6 categories (KPI 9):
--     state_official, district_official, block_official,
--     cluster_official, community_members, third_party_auditors
-- ═══════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW accreditation.mv_dash_process_operations AS
WITH visits AS (
    SELECT
        sa.state_code, sa.academic_year, sa.udise_code,
        (sa.state_official + sa.district_official + sa.block_official
         + sa.cluster_official + sa.community_members + sa.third_party_auditors) > 0 AS visit_conducted,
        sa.state_official, sa.district_official, sa.block_official,
        sa.cluster_official, sa.community_members, sa.third_party_auditors
    FROM accreditation.school_assessment sa
)
SELECT
    v.state_code, v.academic_year,
    COUNT(DISTINCT v.udise_code)                                      AS total_accredited_schools,
    COUNT(DISTINCT v.udise_code) FILTER (WHERE v.visit_conducted)     AS visited_schools,
    ROUND(COUNT(DISTINCT v.udise_code) FILTER (WHERE v.visit_conducted)::numeric
          / NULLIF(COUNT(DISTINCT v.udise_code), 0) * 100, 1)          AS visit_coverage_pct,
    ROUND(COUNT(*) FILTER (WHERE v.state_official > 0)::numeric        / NULLIF(COUNT(*) FILTER (WHERE v.visit_conducted), 0) * 100, 1) AS pct_state_official,
    ROUND(COUNT(*) FILTER (WHERE v.district_official > 0)::numeric     / NULLIF(COUNT(*) FILTER (WHERE v.visit_conducted), 0) * 100, 1) AS pct_district_official,
    ROUND(COUNT(*) FILTER (WHERE v.block_official > 0)::numeric        / NULLIF(COUNT(*) FILTER (WHERE v.visit_conducted), 0) * 100, 1) AS pct_block_official,
    ROUND(COUNT(*) FILTER (WHERE v.cluster_official > 0)::numeric      / NULLIF(COUNT(*) FILTER (WHERE v.visit_conducted), 0) * 100, 1) AS pct_cluster_official,
    ROUND(COUNT(*) FILTER (WHERE v.community_members > 0)::numeric     / NULLIF(COUNT(*) FILTER (WHERE v.visit_conducted), 0) * 100, 1) AS pct_community_members,
    ROUND(COUNT(*) FILTER (WHERE v.third_party_auditors > 0)::numeric  / NULLIF(COUNT(*) FILTER (WHERE v.visit_conducted), 0) * 100, 1) AS pct_third_party_auditors
FROM visits v
GROUP BY v.state_code, v.academic_year;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX ux_mv_process_operations
    ON accreditation.mv_dash_process_operations (state_code, academic_year);


-- ═══════════════════════════════════════════════════════════════
-- MV 4: Domain Components (KPI 11, 12)
-- Aggregates domain-level data:
--   - Domains assessed with state assessment counts (KPI 11)
--   - Domain scores and weightages (KPI 12)
-- Uses latest assessment per school (by assessment_date DESC)
-- to avoid inflating counts from historical re-assessments.
-- Joins via temp_key to domain_assessment_flat.
-- ═══════════════════════════════════════════════════════════════

-- JOIN KEY: school_assessment uses an upsert model (a UDISE_CODE can have
-- multiple rows, one per assessment event). Each event carries a unique
-- domain_assessment_key shared with its domain_assessment_flat score rows,
-- so we join on domain_assessment_key (per-event), not on temp_key/udise_code.


CREATE MATERIALIZED VIEW accreditation.mv_dash_domain_components AS
WITH latest_assessment AS (
    SELECT
        domain_assessment_key,
        udise_code,
        state_code,
        academic_year,
        framework_id
    FROM (
        SELECT
            sa.domain_assessment_key,
            sa.udise_code,
            sa.state_code,
            sa.academic_year,
            sa.framework_id,
            ROW_NUMBER() OVER (
                PARTITION BY sa.udise_code
                ORDER BY sa.assessment_date DESC,
                         sa.domain_assessment_key DESC
            ) AS rn
        FROM accreditation.school_assessment sa
    )
    WHERE rn = 1
),
subdomain_scored AS (
    SELECT
        la.state_code,
        la.academic_year,
        daf.udise_code,
        daf.domain_code,
        daf.sub_domain_code,
        daf.score,
        fd.domain_pk,
        fd.domain_name,
        fd.domain_weightage,
        fsd.subdomain_weightage
    FROM accreditation.domain_assessment_flat daf
    JOIN latest_assessment la
        ON la.domain_assessment_key = daf.domain_assessment_key
    JOIN accreditation.framework_domain fd
        ON fd.framework_id = la.framework_id
       AND fd.domain_code = daf.domain_code
    JOIN accreditation.framework_subdomain fsd
        ON fsd.domain_pk = fd.domain_pk
       AND fsd.sub_domain_code = daf.sub_domain_code
    WHERE daf.status = 'ACTIVE'
),
domain_scored AS (
    SELECT
        state_code,
        academic_year,
        udise_code,
        domain_code,
        domain_name,
        domain_weightage,
        SUM(score * subdomain_weightage)
            / NULLIF(SUM(subdomain_weightage), 0) AS domain_score
    FROM subdomain_scored
    GROUP BY
        state_code,
        academic_year,
        udise_code,
        domain_code,
        domain_name,
        domain_weightage
)
SELECT
    academic_year,
    domain_code,
    domain_name,
    ROUND(AVG(domain_weightage), 2) AS domain_weightage,
    COUNT(DISTINCT state_code) AS states_assessing,
    ROUND(AVG(domain_score), 1) AS avg_score
FROM domain_scored
GROUP BY
    academic_year,
    domain_code,
    domain_name;

CREATE UNIQUE INDEX RTIWARI.ux_mv_domain_components
ON RTIWARI.mv_dash_domain_components
(
    academic_year,
    domain_code
);


-- ═══════════════════════════════════════════════════════════════
-- MV 5: Data Quality & Compliance (KPI 13, 14)
-- Aggregates data quality metrics per state:
--   - Self-disclosure percentage (KPI 13)
--   - Timeliness: on_time_pct, delayed_pct, significantly_delayed_pct (KPI 14)
--   - Average delay in days (KPI 14)
-- Delayed = 1–14 days past deadline; Significantly delayed = >14 days
-- ═══════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW accreditation.mv_dash_data_quality AS
WITH submissions AS (
    SELECT
        sa.state_code, sa.academic_year, sa.udise_code,
        sa.created_date::date                                   AS submitted_date,
        f.target_completion_date,
        (f.target_completion_date - sa.created_date::date)      AS days_before_deadline
    FROM accreditation.school_assessment sa
    JOIN accreditation.accreditation_framework f ON f.framework_id = sa.framework_id
),
total_schools AS (
    SELECT state_code, COUNT(*) AS total_schools
    FROM accreditation.school_master WHERE is_active = true
    GROUP BY state_code
)
SELECT
    s.state_code, s.academic_year,
    COUNT(DISTINCT s.udise_code)                                                        AS schools_submitted,
    ts.total_schools,
    ROUND(COUNT(DISTINCT s.udise_code)::numeric / NULLIF(ts.total_schools, 0) * 100, 1)  AS self_disclosure_pct,
    ROUND(COUNT(*) FILTER (WHERE days_before_deadline >= 0)::numeric / COUNT(*) * 100, 1)               AS on_time_pct,
    ROUND(COUNT(*) FILTER (WHERE days_before_deadline BETWEEN -14 AND -1)::numeric / COUNT(*) * 100, 1) AS delayed_pct,
    ROUND(COUNT(*) FILTER (WHERE days_before_deadline < -14)::numeric / COUNT(*) * 100, 1)              AS significantly_delayed_pct,
    ROUND(AVG(ABS(days_before_deadline)) FILTER (WHERE days_before_deadline < 0), 1)                    AS avg_delay_days
FROM submissions s
LEFT JOIN total_schools ts ON ts.state_code = s.state_code
GROUP BY s.state_code, s.academic_year, ts.total_schools;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX ux_mv_data_quality
    ON accreditation.mv_dash_data_quality (state_code, academic_year);


-- ═══════════════════════════════════════════════════════════════
-- MV 6: Impact/Outcomes & Decision-Making (KPI 15, 16, 17)
-- Aggregates impact metrics per state:
--   - Decision use cases (KPI 15)
--   - Improvement trends: schools_improved, schools_with_prior_assessment,
--     pct_schools_improved, avg_score_change (KPI 16)
--   - Result sharing label (KPI 17)
-- Trend logic: compares each school's current assessment overall score
-- to its immediately preceding one (by assessment_date) via LAG().
-- ═══════════════════════════════════════════════════════════════

-- JOIN KEY: same upsert model as MV4. Each assessment event has a unique
-- domain_assessment_key shared with its domain_assessment_flat score rows.
-- Joining/grouping by domain_assessment_key ensures each event's overall score
-- is computed from its own scores; LAG() over assessment_date then compares
-- consecutive DISTINCT events per school for the improvement trend.
CREATE MATERIALIZED VIEW RTIWARI.mv_dash_impact_outcomes AS
WITH subdomain_scored AS (
    SELECT
        sa.domain_assessment_key,
        sa.udise_code,
        sa.state_code,
        sa.academic_year,
        sa.assessment_date,
        daf.domain_code,
        daf.sub_domain_code,
        daf.score,
        fd.domain_pk,
        fd.domain_weightage,
        fsd.subdomain_weightage
    FROM accreditation.domain_assessment_flat daf
    JOIN accreditation.school_assessment sa
        ON sa.domain_assessment_key = daf.domain_assessment_key
    JOIN accreditation.framework_domain fd
        ON fd.framework_id = sa.framework_id
       AND fd.domain_code = daf.domain_code
    JOIN accreditation.framework_subdomain fsd
        ON fsd.domain_pk = fd.domain_pk
       AND fsd.sub_domain_code = daf.sub_domain_code
    WHERE daf.status = 'ACTIVE'
),

domain_scored AS (
    SELECT
        domain_assessment_key,
        udise_code,
        state_code,
        academic_year,
        assessment_date,
        domain_code,
        domain_weightage,
        SUM(score * subdomain_weightage)
            / NULLIF(SUM(subdomain_weightage), 0) AS domain_score
    FROM subdomain_scored
    GROUP BY
        domain_assessment_key,
        udise_code,
        state_code,
        academic_year,
        assessment_date,
        domain_code,
        domain_weightage
),

assessment_overall AS (
    SELECT
        domain_assessment_key,
        udise_code,
        state_code,
        academic_year,
        assessment_date,
        SUM(domain_score * domain_weightage)
            / NULLIF(SUM(domain_weightage), 0) AS overall_score
    FROM domain_scored
    GROUP BY
        domain_assessment_key,
        udise_code,
        state_code,
        academic_year,
        assessment_date
),

ranked AS (
    SELECT
        domain_assessment_key,
        udise_code,
        state_code,
        academic_year,
        assessment_date,
        overall_score,
        LAG(overall_score) OVER (
            PARTITION BY udise_code
            ORDER BY assessment_date
        ) AS prev_overall_score
    FROM assessment_overall
),

trend AS (
    SELECT
        state_code,
        academic_year,

        /* Schools having a previous assessment */
        SUM(
            CASE
                WHEN prev_overall_score IS NOT NULL THEN 1
                ELSE 0
            END
        ) AS schools_with_prior_assessment,

        /* Schools whose score improved */
        SUM(
            CASE
                WHEN overall_score > prev_overall_score THEN 1
                ELSE 0
            END
        ) AS schools_improved,

        /* Average score change */
        ROUND(
            AVG(
                CASE
                    WHEN prev_overall_score IS NOT NULL
                    THEN overall_score - prev_overall_score
                END
            ),
            1
        ) AS avg_score_change

    FROM ranked
    GROUP BY
        state_code,
        academic_year
)

SELECT
    f.state_code,
    f.academic_year,

    lm_share.label AS sharing_of_result_label,

    f.state_level_decision_use_cases,

    t.schools_improved,
    t.schools_with_prior_assessment,

    ROUND(
        (
            t.schools_improved /
            NULLIF(t.schools_with_prior_assessment, 0)
        ) * 100,
        1
    ) AS pct_schools_improved,

    t.avg_score_change

FROM accreditation.accreditation_framework f

LEFT JOIN accreditation.lookup_master lm_share
    ON lm_share.category = 'SHARING_OF_RESULT'
   AND lm_share.code = f.sharing_of_result

LEFT JOIN trend t
    ON t.state_code = f.state_code
   AND t.academic_year = f.academic_year

WHERE f.is_active = 1;




CREATE UNIQUE INDEX RTIWARI.ux_mv_impact_outcomes
ON RTIWARI.mv_dash_impact_outcomes
(
    state_code,
    academic_year
);

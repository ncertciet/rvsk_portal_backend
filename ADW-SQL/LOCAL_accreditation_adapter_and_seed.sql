-- ============================================================
-- RVSK Portal — Accreditation Dashboard: LOCAL DEV adapter + seed
-- Target: PostgreSQL database "rvsk_accreditation", schema "accreditation"
--
-- PURPOSE (Option A):
--   In production the ADW will provide these flat tables directly:
--     - domain_assessment_flat  (one row per sub-domain score)
--     - state_master
--     - school_master
--   plus flat authority-count columns on school_assessment.
--   For LOCAL DEV we reproduce that flat shape by flattening the jsonb
--   columns that currently exist on accreditation.school_assessment
--   (authorities_visit, domain_assessments), so the spec MV DDL runs
--   UNCHANGED.
--
--   Run order:
--     1) THIS script  (creates + populates the 3 flat tables and the
--        flat authority columns)
--     2) V_accreditation_dashboard_mvs.sql       (creates the 6 MVs)
--     3) V_accreditation_refresh_function.sql     (refresh function)
--     4) SELECT accreditation.refresh_dashboard_views();
--
--   Idempotent: safe to re-run. Uses CREATE TABLE IF NOT EXISTS and
--   TRUNCATE-then-INSERT for the derived tables.
-- ============================================================

SET search_path TO accreditation;

-- ─────────────────────────────────────────────────────────────
-- 1) STATE_MASTER — distinct states from framework + assessments
--    MV usage: coverage/data-quality total_schools GROUP BY state_code;
--    service meta/states reads state_code, state_name.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accreditation.state_master (
    state_code  varchar(10)  PRIMARY KEY,
    state_name  varchar(150) NOT NULL,
    is_active   boolean      NOT NULL DEFAULT true
);

TRUNCATE accreditation.state_master;
INSERT INTO accreditation.state_master (state_code, state_name, is_active)
SELECT DISTINCT sa.state_code,
       COALESCE(
         (SELECT da->'_enrichment'->>'state_name'
          FROM accreditation.school_assessment s2
          CROSS JOIN LATERAL jsonb_array_elements(s2.domain_assessments) da
          WHERE s2.state_code = sa.state_code
            AND da->'_enrichment'->>'state_name' IS NOT NULL
          LIMIT 1),
         sa.state_code)                                   AS state_name,
       true
FROM accreditation.school_assessment sa
WHERE sa.state_code IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2) SCHOOL_MASTER — one row per school (udise_code), used as the
--    coverage denominator (total_schools per state).
--    MV usage: WHERE is_active = true GROUP BY state_code.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accreditation.school_master (
    udise_code   varchar(20)  PRIMARY KEY,
    state_code   varchar(10)  NOT NULL,
    school_name  varchar(250),
    district_name varchar(150),
    block_name   varchar(150),
    is_active    boolean      NOT NULL DEFAULT true
);

TRUNCATE accreditation.school_master;
INSERT INTO accreditation.school_master (udise_code, state_code, school_name, district_name, block_name, is_active)
SELECT DISTINCT ON (sa.udise_code)
       sa.udise_code,
       sa.state_code,
       (da->'_enrichment'->>'school_name'),
       (da->'_enrichment'->>'district_name'),
       (da->'_enrichment'->>'block_name'),
       true
FROM accreditation.school_assessment sa
LEFT JOIN LATERAL jsonb_array_elements(sa.domain_assessments) da ON true
WHERE sa.udise_code IS NOT NULL
ORDER BY sa.udise_code, sa.assessment_date DESC;

-- ─────────────────────────────────────────────────────────────
-- 3) DOMAIN_ASSESSMENT_FLAT — one row per (assessment, domain, subdomain)
--    Flattened from school_assessment.domain_assessments jsonb.
--    MV usage: daf.temp_key (= assessment_id), daf.domain_code,
--    daf.sub_domain_code, daf.score, daf.status, daf.udise_code,
--    and MAX(dw_load_ts) for the refresh watermark.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accreditation.domain_assessment_flat (
    id              bigserial PRIMARY KEY,
    temp_key        uuid        NOT NULL,   -- FK-ish to school_assessment.assessment_id
    udise_code      varchar(20),
    state_code      varchar(10),
    academic_year   varchar(10),
    domain_code     varchar(20) NOT NULL,
    sub_domain_code varchar(20) NOT NULL,
    score           numeric,
    status          varchar(20) NOT NULL DEFAULT 'ACTIVE',
    dw_load_ts      timestamptz NOT NULL DEFAULT now()
);

TRUNCATE accreditation.domain_assessment_flat RESTART IDENTITY;
INSERT INTO accreditation.domain_assessment_flat
    (temp_key, udise_code, state_code, academic_year, domain_code, sub_domain_code, score, status, dw_load_ts)
SELECT
    sa.assessment_id,
    sa.udise_code,
    sa.state_code,
    sa.academic_year,
    da->>'domain_code',
    sd->>'sub_domain_code',
    (sd->>'score')::numeric,
    COALESCE(sd->>'status', 'ACTIVE'),
    now()
FROM accreditation.school_assessment sa
CROSS JOIN LATERAL jsonb_array_elements(sa.domain_assessments) da
CROSS JOIN LATERAL jsonb_array_elements(da->'subdomain_assessments') sd
WHERE sa.domain_assessments IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_daf_temp_key_seed
    ON accreditation.domain_assessment_flat (temp_key);

-- ─────────────────────────────────────────────────────────────
-- 4) Flat authority columns on SCHOOL_ASSESSMENT
--    The process-operations MV reads these as flat integer columns.
--    Add them if absent and backfill from the authorities_visit jsonb.
--    Missing keys (e.g. block_official, cluster_official) default to 0.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE accreditation.school_assessment
    ADD COLUMN IF NOT EXISTS state_official        integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS district_official     integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS block_official        integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cluster_official      integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS community_members     integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS third_party_auditors  integer NOT NULL DEFAULT 0;

UPDATE accreditation.school_assessment sa
SET state_official       = COALESCE((sa.authorities_visit->>'state_official')::int, 0),
    district_official    = COALESCE((sa.authorities_visit->>'district_official')::int, 0),
    block_official       = COALESCE((sa.authorities_visit->>'block_official')::int, 0),
    cluster_official     = COALESCE((sa.authorities_visit->>'cluster_official')::int, 0),
    community_members    = COALESCE((sa.authorities_visit->>'community_members')::int, 0),
    third_party_auditors = COALESCE((sa.authorities_visit->>'third_party_auditors')::int, 0)
WHERE sa.authorities_visit IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 5) Verification counts
-- ─────────────────────────────────────────────────────────────
SELECT 'state_master' AS tbl, count(*) FROM accreditation.state_master
UNION ALL SELECT 'school_master', count(*) FROM accreditation.school_master
UNION ALL SELECT 'domain_assessment_flat', count(*) FROM accreditation.domain_assessment_flat;

-- ============================================================
-- RVSK Portal — PostgreSQL Schema Init
-- Database: rvsk_portal, Schema: rvsk_portal
-- Converted from Oracle ADW (RTIWARI schema)
-- ============================================================

SET search_path TO rvsk_portal;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════
-- MASTER DATA TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE state_master (
    state_code      CHAR(2) PRIMARY KEY,
    state_name      VARCHAR(100),
    state_name_local VARCHAR(100),
    state_type      VARCHAR(10) DEFAULT 'STATE',
    lgd_code        INTEGER,
    capital         VARCHAR(100),
    region          VARCHAR(50),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE district_master (
    district_code       VARCHAR(10) PRIMARY KEY,
    district_name       VARCHAR(100),
    district_name_local VARCHAR(100),
    state_code          CHAR(2) REFERENCES state_master(state_code),
    lgd_code            INTEGER,
    district_type       VARCHAR(30),
    headquarters        VARCHAR(100),
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE block_master (
    block_code       VARCHAR(20) PRIMARY KEY,
    block_name       VARCHAR(100),
    block_name_local VARCHAR(100),
    district_code    VARCHAR(10) REFERENCES district_master(district_code),
    lgd_code         INTEGER,
    block_type       VARCHAR(30),
    is_urban         BOOLEAN DEFAULT FALSE,
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cluster_master (
    cluster_code  VARCHAR(20) PRIMARY KEY,
    cluster_name  VARCHAR(100),
    block_code    VARCHAR(20) REFERENCES block_master(block_code),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- AUTH & USERS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE portal_users (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username            VARCHAR(255) NOT NULL UNIQUE,
    display_name        VARCHAR(255),
    password_hash       VARCHAR(255),
    role                VARCHAR(50) NOT NULL,
    state_code          CHAR(2),
    district_code       VARCHAR(10),
    is_active           BOOLEAN DEFAULT TRUE NOT NULL,
    is_first_login      BOOLEAN DEFAULT TRUE,
    phone               VARCHAR(15),
    designation         VARCHAR(100),
    department          VARCHAR(100),
    password_changed_at TIMESTAMPTZ,
    created_by          UUID,
    failed_attempts     INTEGER DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    user_email          VARCHAR(255),
    contact_email       VARCHAR(255),
    mobile_number       VARCHAR(15)
);

CREATE INDEX idx_portal_users_role ON portal_users(role);
CREATE INDEX idx_portal_users_state ON portal_users(state_code);
CREATE INDEX idx_portal_users_username ON portal_users(username);
CREATE INDEX idx_portal_users_active ON portal_users(is_active);

-- ═══════════════════════════════════════════════════════════════
-- RBAC — MODULE & PAGE MASTER
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE module_master (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_code     VARCHAR(30) NOT NULL UNIQUE,
    module_name     VARCHAR(100) NOT NULL,
    icon            VARCHAR(50),
    display_order   INTEGER NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE NOT NULL,
    created_by      UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_module_active ON module_master(is_active);

CREATE TABLE page_master (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id       UUID NOT NULL REFERENCES module_master(id),
    page_code       VARCHAR(50) NOT NULL,
    page_name       VARCHAR(100) NOT NULL,
    route_path      VARCHAR(200) NOT NULL UNIQUE,
    icon            VARCHAR(50),
    display_order   INTEGER NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE NOT NULL,
    created_by      UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(module_id, page_code)
);

CREATE INDEX idx_page_module ON page_master(module_id);
CREATE INDEX idx_page_active ON page_master(is_active);

-- Legacy RBAC tables (V25)
CREATE TABLE role_page_defaults (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role        VARCHAR(50) NOT NULL,
    module      VARCHAR(20) NOT NULL,
    page_id     VARCHAR(50) NOT NULL,
    can_view    BOOLEAN DEFAULT TRUE NOT NULL,
    can_export  BOOLEAN DEFAULT FALSE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, module, page_id)
);

CREATE TABLE user_page_overrides (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID NOT NULL,
    module      VARCHAR(20) NOT NULL,
    page_id     VARCHAR(50) NOT NULL,
    can_view    BOOLEAN,
    can_export  BOOLEAN,
    updated_by  UUID,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, module, page_id)
);

-- V2 RBAC tables (FK-based)
CREATE TABLE role_page_defaults_v2 (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role        VARCHAR(50) NOT NULL,
    page_id     UUID NOT NULL REFERENCES page_master(id),
    can_view    BOOLEAN DEFAULT TRUE NOT NULL,
    can_edit    BOOLEAN DEFAULT FALSE NOT NULL,
    can_export  BOOLEAN DEFAULT FALSE NOT NULL,
    can_delete  BOOLEAN DEFAULT FALSE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(role, page_id)
);

CREATE INDEX idx_rpd_v2_role ON role_page_defaults_v2(role);
CREATE INDEX idx_rpd_v2_page ON role_page_defaults_v2(page_id);

CREATE TABLE user_page_overrides_v2 (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES portal_users(id),
    page_id     UUID NOT NULL REFERENCES page_master(id),
    can_view    BOOLEAN,
    can_edit    BOOLEAN,
    can_export  BOOLEAN,
    can_delete  BOOLEAN,
    updated_by  UUID,
    updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, page_id)
);

CREATE INDEX idx_upo_v2_user ON user_page_overrides_v2(user_id);
CREATE INDEX idx_upo_v2_page ON user_page_overrides_v2(page_id);

-- ═══════════════════════════════════════════════════════════════
-- GRIEVANCE MODULE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE grievance_categories (
    code        VARCHAR(50) PRIMARY KEY,
    label       VARCHAR(200) NOT NULL,
    parent_code VARCHAR(50) REFERENCES grievance_categories(code),
    sort_order  INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE
);

CREATE TABLE grievances (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    grievance_id    VARCHAR(50) NOT NULL UNIQUE,
    created_by      UUID NOT NULL REFERENCES portal_users(id),
    state_code      VARCHAR(2),
    district_code   VARCHAR(10),
    assigned_to     UUID REFERENCES portal_users(id),
    category        VARCHAR(50) NOT NULL,
    sub_category    VARCHAR(50),
    subject         VARCHAR(200) NOT NULL,
    description     TEXT,
    status          VARCHAR(30) DEFAULT 'OPEN' NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_grv_status ON grievances(status);
CREATE INDEX idx_grv_created_by ON grievances(created_by);
CREATE INDEX idx_grv_assigned_to ON grievances(assigned_to);
CREATE INDEX idx_grv_state_code ON grievances(state_code);

CREATE TABLE grievance_attachments (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    grievance_id    UUID NOT NULL REFERENCES grievances(id),
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    file_type       VARCHAR(100),
    file_size       BIGINT,
    uploaded_by     UUID NOT NULL REFERENCES portal_users(id),
    uploaded_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE grievance_history (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    grievance_id    UUID NOT NULL REFERENCES grievances(id),
    action          VARCHAR(100) NOT NULL,
    old_status      VARCHAR(30),
    new_status      VARCHAR(30),
    comments        TEXT,
    is_internal     BOOLEAN DEFAULT FALSE,
    performed_by    UUID NOT NULL REFERENCES portal_users(id),
    performed_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_grv_hist_grievance ON grievance_history(grievance_id);

CREATE TABLE grievance_responses (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    grievance_id    UUID NOT NULL REFERENCES grievances(id),
    response_text   TEXT NOT NULL,
    responded_by    UUID NOT NULL REFERENCES portal_users(id),
    responded_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- FORMS MODULE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE form_master (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    instructions    TEXT,
    status          VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
    due_date        TIMESTAMPTZ,
    publish_date    TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES portal_users(id),
    created_date    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_by      UUID,
    updated_date    TIMESTAMPTZ
);

CREATE INDEX idx_form_master_status ON form_master(status);

CREATE TABLE form_question (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    form_id         UUID NOT NULL REFERENCES form_master(id),
    question_text   VARCHAR(1000) NOT NULL,
    field_type      VARCHAR(20) NOT NULL,
    is_required     BOOLEAN DEFAULT FALSE NOT NULL,
    help_text       VARCHAR(500),
    options_json    TEXT,
    display_order   INTEGER NOT NULL,
    created_date    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_fq_form_id ON form_question(form_id);

CREATE TABLE form_assignment (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    form_id             UUID NOT NULL REFERENCES form_master(id),
    state_code          VARCHAR(10) NOT NULL,
    submission_status   VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    assigned_date       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    submitted_date      TIMESTAMPTZ,
    submitted_by        UUID REFERENCES portal_users(id)
);

CREATE INDEX idx_fa_form_state ON form_assignment(form_id, state_code);

CREATE TABLE form_response (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    form_id         UUID NOT NULL REFERENCES form_master(id),
    state_code      VARCHAR(10) NOT NULL,
    submitted_by    UUID NOT NULL REFERENCES portal_users(id),
    submitted_date  TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'DRAFT' NOT NULL
);

CREATE INDEX idx_fr_form_state ON form_response(form_id, state_code);

CREATE TABLE form_response_detail (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    response_id     UUID NOT NULL REFERENCES form_response(id),
    question_id     UUID NOT NULL REFERENCES form_question(id),
    answer_value    TEXT
);

CREATE INDEX idx_frd_response ON form_response_detail(response_id);

CREATE TABLE form_attachments (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    form_id         UUID NOT NULL REFERENCES form_master(id),
    response_id     UUID REFERENCES form_response(id),
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    file_type       VARCHAR(50),
    file_size       BIGINT,
    uploaded_by     UUID NOT NULL REFERENCES portal_users(id),
    uploaded_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE form_audit (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    form_id         UUID NOT NULL REFERENCES form_master(id),
    action          VARCHAR(50) NOT NULL,
    user_id         UUID NOT NULL REFERENCES portal_users(id),
    action_date     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- VSK MODULE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE vsk_profile (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    state_code              VARCHAR(2) NOT NULL UNIQUE,
    address_line1           VARCHAR(500),
    address_line2           VARCHAR(500),
    city                    VARCHAR(200),
    pincode                 VARCHAR(10),
    facilitated_by          VARCHAR(200),
    other_scheme_name       VARCHAR(200),
    step1_status            VARCHAR(20) DEFAULT 'PENDING',
    step2_status            VARCHAR(20) DEFAULT 'PENDING',
    step3_status            VARCHAR(20) DEFAULT 'PENDING',
    step4_status            VARCHAR(20) DEFAULT 'PENDING',
    submission_status       VARCHAR(20) DEFAULT 'DRAFT',
    declaration_certified   BOOLEAN DEFAULT FALSE,
    created_by              UUID,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_by              UUID,
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vsk_profile_state ON vsk_profile(state_code);

CREATE TABLE vsk_officer_history (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    state_code      VARCHAR(2) NOT NULL,
    officer_role    VARCHAR(20) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    designation     VARCHAR(200),
    phone           VARCHAR(15),
    whatsapp        VARCHAR(15),
    email           VARCHAR(200),
    start_date      DATE,
    end_date        DATE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      UUID,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vsk_officer_state_role ON vsk_officer_history(state_code, officer_role, is_active);

CREATE TABLE vsk_committee_member (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    state_code      VARCHAR(2) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    designation     VARCHAR(200),
    phone           VARCHAR(15),
    whatsapp        VARCHAR(15),
    email           VARCHAR(200),
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      UUID,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vsk_committee_state ON vsk_committee_member(state_code, is_active);

CREATE TABLE vsk_infra_hardware (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    state_code              VARCHAR(2) NOT NULL UNIQUE,
    room_length             NUMERIC(10,2),
    room_width              NUMERIC(10,2),
    room_height             NUMERIC(10,2),
    room_image_url          VARCHAR(500),
    screen_length           NUMERIC(10,2),
    screen_height           NUMERIC(10,2),
    screen_image_url        VARCHAR(500),
    workstation_count       INTEGER,
    workstation_image_url   VARCHAR(500),
    created_by              UUID,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_by              UUID,
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vsk_software_header (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    state_code      VARCHAR(2) NOT NULL UNIQUE,
    starter_pack    BOOLEAN DEFAULT FALSE,
    server_type     VARCHAR(100),
    created_by      UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_by      UUID,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vsk_software_item (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    header_id               UUID NOT NULL REFERENCES vsk_software_header(id),
    software_name           VARCHAR(200),
    custom_software_name    VARCHAR(200),
    software_type           VARCHAR(20),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vsk_software_item_header ON vsk_software_item(header_id);

CREATE TABLE vsk_pmu_header (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    state_code          VARCHAR(2) NOT NULL UNIQUE,
    pmu_team_type       VARCHAR(100),
    total_team_members  INTEGER,
    created_by          UUID,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_by          UUID,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vsk_pmu_role_structure (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    header_id           UUID NOT NULL REFERENCES vsk_pmu_header(id),
    role_name           VARCHAR(200),
    custom_role_name    VARCHAR(200),
    no_of_members       INTEGER,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vsk_pmu_role_header ON vsk_pmu_role_structure(header_id);

CREATE TABLE vsk_audit_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_name     VARCHAR(100) NOT NULL,
    entity_id       UUID NOT NULL,
    action_type     VARCHAR(20) NOT NULL,
    old_values      TEXT,
    new_values      TEXT,
    user_id         UUID,
    user_name       VARCHAR(200),
    user_state_code VARCHAR(2),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vsk_audit_entity ON vsk_audit_log(entity_name, entity_id);
CREATE INDEX idx_vsk_audit_user ON vsk_audit_log(user_id);
CREATE INDEX idx_vsk_audit_date ON vsk_audit_log(created_at);

-- ═══════════════════════════════════════════════════════════════
-- GALLERY & ACTIVITY LOG
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE vsk_gallery_images (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    state_code      VARCHAR(10) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    thumbnail_path  VARCHAR(500),
    caption         VARCHAR(500),
    file_type       VARCHAR(50) NOT NULL,
    file_size       BIGINT NOT NULL,
    uploaded_by     UUID NOT NULL REFERENCES portal_users(id),
    uploaded_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE INDEX idx_vg_state_code ON vsk_gallery_images(state_code);
CREATE INDEX idx_vg_is_active ON vsk_gallery_images(is_active);

CREATE TABLE activity_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module          VARCHAR(50) NOT NULL,
    action          VARCHAR(100) NOT NULL,
    description     VARCHAR(500),
    entity_id       VARCHAR(100),
    performed_by    UUID NOT NULL REFERENCES portal_users(id),
    performed_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    state_code      VARCHAR(10)
);

CREATE INDEX idx_al_performed_at ON activity_log(performed_at DESC);
CREATE INDEX idx_al_module ON activity_log(module);

-- ═══════════════════════════════════════════════════════════════
-- SEQUENCE (for daily grievance ID generation)
-- ═══════════════════════════════════════════════════════════════

CREATE SEQUENCE seq_grievance_daily START WITH 1 INCREMENT BY 1;

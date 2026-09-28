# RVSK Portal — Table Classification & Data Cleanup Reference

Schema: `rvsk_portal` (PostgreSQL). This document classifies every base table
into **Reference / Prefilled** (config the app needs to boot and operate) vs
**Transactional** (user-generated runtime data, safe to clean).

It is the companion to:
- `portal_data_seed.sql` — seeds the reference/prefilled tables.
- `data_cleanup_transactional.sql` — truncates transactional data module-wise.

---

## A. Reference / Prefilled tables (REQUIRED for first-run)

These must be populated before the application is usable. They are seeded by
`portal_data_seed.sql`. **Never** cleaned by the transactional cleanup script.

| Table | Purpose | Seeded by |
|---|---|---|
| `portal_role` | Role master (single source of truth for roles; `portal_users.role_id` FK). | seed §1 |
| `module_master` | Top-level navigation modules. | seed §2 |
| `page_master` | Pages within modules; drives DB-driven sidebar + RBAC. | seed §3 |
| `role_page_defaults_v2` | Role → page permission grants (view/edit/export/delete). Exported verbatim from the configured environment. | seed §5 |
| `grievance_categories` | Grievance category + sub-category dropdown tree. | seed §6 |
| `email_layout` | Single active DEFAULT branding layout wrapping all emails. | seed §7 |
| `notification_config` | 17 configurable email notification events + templates. | seed §8 |
| `portal_users` (admins only) | Bootstrap **Super_Admin + RVSK_Admin** only; every other user is created in-app by these two. | seed §4 |

### Legacy / superseded reference tables (present but NOT seeded)
| Table | Status |
|---|---|
| `role_page_defaults` | Legacy V1 RBAC (string page_id). Superseded by `role_page_defaults_v2`. Left empty. |
| `user_page_overrides` | Legacy V1 per-user overrides. Superseded by `user_page_overrides_v2`. Left empty. |
| `migrations` | TypeORM migration ledger. Managed by TypeORM, never seeded/cleaned manually. |

---

## B. Transactional tables (user-generated — cleanup targets)

Grouped by functional module. Cleanup order respects foreign keys
(children deleted before parents).

### 1. Grievance module
| Table | Notes |
|---|---|
| `grievance_responses` | FK → grievances, portal_users |
| `grievance_history` | FK → grievances, portal_users |
| `grievance_attachments` | FK → grievances, portal_users |
| `grievances` | FK → portal_users (created_by, assigned_to) |
| _sequence_ `seq_grievance_daily` | Reset to 1 after cleanup |

> `grievance_categories` is **reference data** — NOT cleaned.

### 2. Form Builder module
| Table | Notes |
|---|---|
| `form_response_detail` | FK → form_response, form_question |
| `form_attachments` | FK → form_master, form_response, portal_users |
| `form_audit` | FK → form_master, portal_users |
| `form_response` | FK → form_master, portal_users |
| `form_assignment` | FK → form_master, portal_users |
| `form_question` | FK → form_master |
| `form_master` | FK → portal_users |

### 3. VSK Management module
| Table | Notes |
|---|---|
| `vsk_software_item` | FK → vsk_software_header |
| `vsk_pmu_role_structure` | FK → vsk_pmu_header |
| `vsk_software_header` | state-scoped |
| `vsk_pmu_header` | state-scoped |
| `vsk_infra_hardware` | state-scoped |
| `vsk_committee_member` | state-scoped |
| `vsk_officer_history` | state-scoped |
| `vsk_profile` | state-scoped |
| `vsk_gallery_images` | FK → portal_users |
| `vsk_audit_log` | insert-only audit trail |

### 4. State–SPOC Assignment
| Table | Notes |
|---|---|
| `state_spoc_mapping` | FK → portal_users (spoc_user_id). Maps a State to its active SPOC. |

### 5. Cross-cutting logs / runtime
| Table | Notes |
|---|---|
| `notification_log` | Email send log — cleared per request. |
| `activity_log` | Recent-activity feed — cleared per request. |
| `notification_config_audit` | Config change trail — cleared with notification cleanup. |
| `password_reset_otp` | Forgot-password OTP tokens — transient. |

---

## C. `portal_users` special handling

`portal_users` is **mixed**: it holds both bootstrap admins (reference) and
operational users (transactional). The cleanup script deletes only NON-admin
users and their dependent rows (`user_page_overrides_v2`, `state_spoc_mapping`
where they are the SPOC, and any grievances/forms they authored are removed by
the module cleanups above). The two bootstrap admins
(`Super_Admin`, `RVSK_Admin`) are preserved.

> Because many transactional tables FK to `portal_users`, user cleanup must run
> **after** all module cleanups. The cleanup script enforces this order.

---

## D. Key schema facts (post-migration, verified against live DB)

- `portal_users.role` (VARCHAR) was **dropped**; role is now `role_id` FK → `portal_role`.
- Geographic scope uses `state_key`/`state_name` (+ district/block/cluster) — the
  legacy `state_code`/`district_code` columns were dropped.
- `route_path` is UNIQUE on `page_master` and is the portable key used to map
  `role_page_defaults_v2` rows across environments (`page_code` is not globally unique).
- Admin pages are attached to the `SUPERADMIN` module (a separate `ADMINISTRATION`
  module also exists but the admin pages resolve to `SUPERADMIN`).

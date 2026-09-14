import { HttpStatus } from '@nestjs/common';

/**
 * Central Error Catalog — the single source of truth for API error codes.
 *
 * Every entry maps a machine-readable errorCode to:
 *   - status:  the HTTP status returned to the client
 *   - message: a USER-FACING message safe to display directly in the UI
 *
 * Rules:
 *   - Codes are SCREAMING_SNAKE_CASE and grouped by domain prefix.
 *   - Messages must be safe to show to end users (no internal detail,
 *     no SQL, no stack traces). Internal detail belongs in server logs.
 *   - Add new codes here rather than inventing ad-hoc strings in services.
 *
 * Usage in services/controllers:
 *   throw new AppException('USER_NOT_FOUND');
 *   throw new AppException('ACCR_NO_DATA', 'no rows for 2026-27'); // 2nd arg = internal detail (logged, not shown)
 */
export const ERROR_CATALOG = {
  // ── Generic ────────────────────────────────────────────────
  INTERNAL_ERROR: { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'An unexpected error occurred. Please try again.' },
  VALIDATION_FAILED: { status: HttpStatus.BAD_REQUEST, message: 'One or more fields are invalid.' },
  NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'The requested resource was not found.' },
  BAD_REQUEST: { status: HttpStatus.BAD_REQUEST, message: 'The request was invalid.' },
  CONFLICT: { status: HttpStatus.CONFLICT, message: 'The request conflicts with the current state.' },
  DATABASE_UNREACHABLE: { status: HttpStatus.SERVICE_UNAVAILABLE, message: 'Service temporarily unavailable. Please try again later.' },

  // ── Authentication / Authorization ─────────────────────────
  AUTH_UNAUTHORIZED: { status: HttpStatus.UNAUTHORIZED, message: 'You are not authenticated. Please log in.' },
  AUTH_INVALID_CREDENTIALS: { status: HttpStatus.UNAUTHORIZED, message: 'Invalid username or password.' },
  AUTH_TOKEN_EXPIRED: { status: HttpStatus.UNAUTHORIZED, message: 'Your session has expired. Please log in again.' },
  AUTH_FORBIDDEN: { status: HttpStatus.FORBIDDEN, message: 'You do not have permission to perform this action.' },
  AUTH_ACCOUNT_LOCKED: { status: HttpStatus.FORBIDDEN, message: 'Your account is locked. Please contact an administrator.' },

  // ── Users ──────────────────────────────────────────────────
  USER_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'User not found.' },
  USER_ALREADY_EXISTS: { status: HttpStatus.CONFLICT, message: 'A user with this username already exists.' },
  USER_NO_STATE_ASSIGNED: { status: HttpStatus.BAD_REQUEST, message: 'This user has no state assigned.' },

  // ── RBAC (modules / pages) ─────────────────────────────────
  MODULE_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Module not found.' },
  MODULE_ALREADY_EXISTS: { status: HttpStatus.CONFLICT, message: 'A module with this code already exists.' },
  PAGE_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Page not found.' },
  PAGE_ALREADY_EXISTS: { status: HttpStatus.CONFLICT, message: 'A page with this code already exists.' },

  // ── Forms / Questions / Responses ──────────────────────────
  FORM_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Form not found.' },
  FORM_INVALID_STATUS: { status: HttpStatus.BAD_REQUEST, message: 'This operation is not allowed for the current form status.' },
  FORM_NO_QUESTIONS: { status: HttpStatus.BAD_REQUEST, message: 'A form must have at least one question to publish.' },
  QUESTION_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Question not found.' },
  QUESTION_OPTIONS_REQUIRED: { status: HttpStatus.BAD_REQUEST, message: 'Options are required for dropdown, radio, and checkbox fields.' },
  RESPONSE_REQUIRED_UNANSWERED: { status: HttpStatus.BAD_REQUEST, message: 'Please answer all required questions.' },

  // ── Grievances ─────────────────────────────────────────────
  GRIEVANCE_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Grievance not found.' },
  GRIEVANCE_INVALID_TRANSITION: { status: HttpStatus.BAD_REQUEST, message: 'This status change is not allowed.' },
  GRIEVANCE_INVALID_STATE: { status: HttpStatus.BAD_REQUEST, message: 'The grievance is not in a valid state for this action.' },
  CATEGORY_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Category not found.' },

  // ── File uploads ───────────────────────────────────────────
  FILE_EMPTY: { status: HttpStatus.BAD_REQUEST, message: 'The uploaded file is empty.' },
  FILE_TOO_LARGE: { status: HttpStatus.BAD_REQUEST, message: 'The file exceeds the maximum allowed size (5 MB).' },
  FILE_TYPE_NOT_ALLOWED: { status: HttpStatus.BAD_REQUEST, message: 'This file type is not allowed. Allowed: PDF, JPEG, PNG, DOC, DOCX.' },
  ATTACHMENT_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Attachment not found.' },

  // ── VSK ────────────────────────────────────────────────────
  VSK_FORM_SUBMITTED: { status: HttpStatus.FORBIDDEN, message: 'The VSK form has been submitted. No further changes are allowed.' },
  OFFICER_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Officer not found.' },
  MEMBER_NOT_FOUND: { status: HttpStatus.NOT_FOUND, message: 'Committee member not found.' },

  // ── Accreditation dashboard ────────────────────────────────
  ACCR_NO_DATA: { status: HttpStatus.NOT_FOUND, message: 'No dashboard data is available for the selected filters.' },
  ACCR_MV_UNAVAILABLE: { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'The dashboard data source is temporarily unavailable.' },
  ACCR_KPI_NOT_AVAILABLE: { status: HttpStatus.NOT_FOUND, message: 'The requested KPI is not available.' },
  ACCR_INVALID_KPI: { status: HttpStatus.BAD_REQUEST, message: 'Invalid KPI number. It must be an integer between 1 and 20.' },
} as const;

/** Union of all valid error codes. */
export type ErrorCode = keyof typeof ERROR_CATALOG;

/** Returns the catalog entry for a code, falling back to INTERNAL_ERROR. */
export function getCatalogEntry(code: ErrorCode): { status: number; message: string } {
  return ERROR_CATALOG[code] ?? ERROR_CATALOG.INTERNAL_ERROR;
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-NOTIFY-EMAIL-003 — Configurable Email Notification Framework.
 *
 * Creates rvsk_portal.notification_config and seeds the 15-event catalogue with
 * factory-default subject/body templates (stored in BOTH the editable
 * *_template columns and the default_* columns for reset-to-default) and the
 * allowed placeholder tokens per event. `email_enabled` defaults FALSE so the
 * Super Admin turns on each event deliberately.
 *
 * Note: `body_template` holds only the event-specific INNER content; the shared
 * branded layout (email_layout) wraps it at render time.
 */
export class CreateNotificationConfig1758700000000 implements MigrationInterface {
  name = 'CreateNotificationConfig1758700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';
    const table = `${schema}.notification_config`;

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_code       VARCHAR(60) NOT NULL UNIQUE,
        event_name       VARCHAR(120) NOT NULL,
        description      VARCHAR(255),
        email_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
        recipient_type   VARCHAR(20) NOT NULL DEFAULT 'USER',
        recipient_value  VARCHAR(255),
        cc               VARCHAR(500),
        bcc              VARCHAR(500),
        subject_template TEXT,
        body_template    TEXT,
        text_template    TEXT,
        default_subject  TEXT NOT NULL,
        default_body     TEXT NOT NULL,
        allowed_tokens   TEXT,
        is_customized    BOOLEAN NOT NULL DEFAULT FALSE,
        is_active        BOOLEAN NOT NULL DEFAULT TRUE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by       UUID,
        updated_by       UUID
      )
    `);

    // event_code, event_name, description, recipient_type, subject, body, allowed_tokens
    const events: Array<{
      code: string;
      name: string;
      desc: string;
      recipient: string;
      subject: string;
      body: string;
      tokens: string;
    }> = [
      {
        code: 'USER_CREATED',
        name: 'User Created',
        desc: 'Sent to a newly created portal user.',
        recipient: 'USER',
        subject: 'Welcome to {{brand_name}} — Your account is ready',
        body: '<p>Dear {{user_name}},</p><p>Your {{brand_name}} account has been created.</p><p><strong>User ID:</strong> {{user_id}}</p><p>Please sign in at <a href="{{portal_url}}">{{portal_url}}</a> and change your password on first login.</p>',
        tokens: 'user_name,user_id,portal_url,brand_name',
      },
      {
        code: 'PASSWORD_RESET',
        name: 'Password Reset by Administrator',
        desc: 'Sent when a Super Admin or RVSK Admin resets a user\u2019s password.',
        recipient: 'USER',
        subject: 'Your {{brand_name}} password was reset',
        body: '<p>Dear {{user_name}},</p><p>An administrator has reset your {{brand_name}} password.</p><p>Please sign in at <a href="{{portal_url}}">{{portal_url}}</a> and set a new password.</p>',
        tokens: 'user_name,user_id,portal_url,brand_name',
      },
      {
        code: 'USER_ACTIVATED',
        name: 'User Activated',
        desc: 'Sent when a user account is activated.',
        recipient: 'USER',
        subject: 'Your {{brand_name}} account has been activated',
        body: '<p>Dear {{user_name}},</p><p>Your {{brand_name}} account is now active. You can sign in at <a href="{{portal_url}}">{{portal_url}}</a>.</p>',
        tokens: 'user_name,user_id,portal_url,brand_name',
      },
      {
        code: 'USER_DEACTIVATED',
        name: 'User Deactivated',
        desc: 'Sent when a user account is deactivated.',
        recipient: 'USER',
        subject: 'Your {{brand_name}} account has been deactivated',
        body: '<p>Dear {{user_name}},</p><p>Your {{brand_name}} account has been deactivated. If you believe this is an error, please contact {{support_email}}.</p>',
        tokens: 'user_name,user_id,support_email,brand_name',
      },
      {
        code: 'USER_ROLE_CHANGED',
        name: 'User Role Changed',
        desc: 'Sent when a user\u2019s role is changed.',
        recipient: 'USER',
        subject: 'Your role on {{brand_name}} has changed',
        body: '<p>Dear {{user_name}},</p><p>Your role has been updated to <strong>{{role_name}}</strong> on {{brand_name}}.</p>',
        tokens: 'user_name,role_name,portal_url,brand_name',
      },
      {
        code: 'USER_ACCOUNT_LOCKED',
        name: 'Account Locked',
        desc: 'Security alert sent when an account is locked after too many failed logins.',
        recipient: 'USER',
        subject: 'Security alert: your {{brand_name}} account is locked',
        body: '<p>Dear {{user_name}},</p><p>Your {{brand_name}} account has been temporarily locked due to multiple failed sign-in attempts. It will unlock automatically, or contact {{support_email}} for assistance.</p>',
        tokens: 'user_name,support_email,brand_name',
      },
      {
        code: 'USER_ACCOUNT_UNLOCKED',
        name: 'Account Unlocked',
        desc: 'Sent when an administrator unlocks a user account.',
        recipient: 'USER',
        subject: 'Your {{brand_name}} account has been unlocked',
        body: '<p>Dear {{user_name}},</p><p>Your {{brand_name}} account has been unlocked. You can sign in at <a href="{{portal_url}}">{{portal_url}}</a>.</p>',
        tokens: 'user_name,portal_url,brand_name',
      },
      {
        code: 'PASSWORD_CHANGED',
        name: 'Password Changed',
        desc: 'Confirmation sent when a user changes their own password.',
        recipient: 'USER',
        subject: 'Your {{brand_name}} password was changed',
        body: '<p>Dear {{user_name}},</p><p>This confirms your {{brand_name}} password was changed. If you did not do this, contact {{support_email}} immediately.</p>',
        tokens: 'user_name,support_email,brand_name',
      },
      {
        code: 'GRIEVANCE_CREATED',
        name: 'Grievance Created',
        desc: 'Sent to the state-mapped SPOC when a grievance is logged.',
        recipient: 'SPOC',
        subject: 'New grievance logged: {{grievance_id}}',
        body: '<p>Dear {{spoc_name}},</p><p>A new grievance has been logged for {{state_name}}.</p><p><strong>Reference:</strong> {{grievance_id}}<br/><strong>Subject:</strong> {{grievance_subject}}</p><p>Please review it at <a href="{{portal_url}}">{{portal_url}}</a>.</p>',
        tokens: 'spoc_name,grievance_id,grievance_subject,state_name,portal_url,brand_name',
      },
      {
        code: 'GRIEVANCE_ASSIGNED_TO_SPOC',
        name: 'Grievance Assigned to SPOC',
        desc: 'Sent to the assigned SPOC when a grievance is assigned.',
        recipient: 'SPOC',
        subject: 'Grievance assigned to you: {{grievance_id}}',
        body: '<p>Dear {{spoc_name}},</p><p>Grievance <strong>{{grievance_id}}</strong> ({{grievance_subject}}) for {{state_name}} has been assigned to you.</p><p>Please take action at <a href="{{portal_url}}">{{portal_url}}</a>.</p>',
        tokens: 'spoc_name,grievance_id,grievance_subject,state_name,portal_url,brand_name',
      },
      {
        code: 'GRIEVANCE_CLOSED',
        name: 'Grievance Closed / Resolved',
        desc: 'Sent to the grievance creator when it is closed/resolved.',
        recipient: 'CUSTOM',
        subject: 'Your grievance {{grievance_id}} has been resolved',
        body: '<p>Dear {{user_name}},</p><p>Your grievance <strong>{{grievance_id}}</strong> ({{grievance_subject}}) has been resolved and closed.</p><p>You can review the resolution at <a href="{{portal_url}}">{{portal_url}}</a>.</p>',
        tokens: 'user_name,grievance_id,grievance_subject,portal_url,brand_name',
      },
      {
        code: 'GRIEVANCE_REOPENED',
        name: 'Grievance Reopened',
        desc: 'Sent to the assigned SPOC when a grievance is reopened.',
        recipient: 'SPOC',
        subject: 'Grievance reopened: {{grievance_id}}',
        body: '<p>Dear {{spoc_name}},</p><p>Grievance <strong>{{grievance_id}}</strong> ({{grievance_subject}}) has been reopened and needs your attention.</p><p>Please review it at <a href="{{portal_url}}">{{portal_url}}</a>.</p>',
        tokens: 'spoc_name,grievance_id,grievance_subject,portal_url,brand_name',
      },
      {
        code: 'FORM_PUBLISHED_TO_STATE',
        name: 'Form Published to State',
        desc: 'Sent to each assigned state when a form is published.',
        recipient: 'STATE',
        subject: 'New form to complete: {{form_title}}',
        body: '<p>Dear {{state_name}} team,</p><p>A new form <strong>{{form_title}}</strong> has been published for your state{{due_date_clause}}.</p><p>Please complete it at <a href="{{portal_url}}">{{portal_url}}</a>.</p>',
        tokens: 'state_name,form_title,due_date,portal_url,brand_name',
      },
      {
        code: 'FORM_SUBMITTED_BY_STATE',
        name: 'Form Submitted by State',
        desc: 'Sent to the form creator / RVSK admins when a state submits a form.',
        recipient: 'ROLE',
        subject: 'Form submitted by {{state_name}}: {{form_title}}',
        body: '<p>The form <strong>{{form_title}}</strong> was submitted by <strong>{{state_name}}</strong> on {{submitted_at}}.</p><p>Review submissions at <a href="{{portal_url}}">{{portal_url}}</a>.</p>',
        tokens: 'state_name,form_title,submitted_at,portal_url,brand_name',
      },
      {
        code: 'FORM_SUBMISSION_REMINDER',
        name: 'Form Submission Reminder',
        desc: 'Manual reminder to states whose submission is still pending.',
        recipient: 'STATE',
        subject: 'Reminder: please submit {{form_title}}',
        body: '<p>Dear {{state_name}} team,</p><p>This is a reminder that the form <strong>{{form_title}}</strong> is still pending submission{{due_date_clause}}.</p><p>Please complete it at <a href="{{portal_url}}">{{portal_url}}</a>.</p>',
        tokens: 'state_name,form_title,due_date,portal_url,brand_name',
      },
    ];

    const roleValue = "'ROLE'"; // for FORM_SUBMITTED_BY_STATE recipient_value default
    for (const e of events) {
      const recipientValue =
        e.code === 'FORM_SUBMITTED_BY_STATE' ? "'RVSK_Admin'" : 'NULL';
      await queryRunner.query(
        `INSERT INTO ${table}
           (event_code, event_name, description, recipient_type, recipient_value,
            subject_template, body_template, default_subject, default_body, allowed_tokens)
         VALUES ($1, $2, $3, $4, ${recipientValue}, $5, $6, $5, $6, $7)
         ON CONFLICT (event_code) DO NOTHING`,
        [e.code, e.name, e.desc, e.recipient, e.subject, e.body, e.tokens],
      );
    }
    void roleValue;
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';
    await queryRunner.query(
      `DROP TABLE IF EXISTS ${schema}.notification_config`,
    );
  }
}

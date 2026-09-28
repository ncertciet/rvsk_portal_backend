import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-GRV-SPOC-003 (notifications) — adds two configurable email events to the
 * existing notification framework (RVSK-NOTIFY-EMAIL-003):
 *   - SPOC_STATE_ASSIGNED   (fresh assignment of a state to a SPOC)
 *   - SPOC_STATE_REASSIGNED (state moved from one SPOC to another)
 *
 * Both use recipient_type = CUSTOM (the SPOC email is supplied in the notify
 * context). email_enabled defaults FALSE — the Super Admin enables/edits them
 * from the existing Email Notification Configuration page.
 */
export class AddSpocStateNotificationEvents1758800100000
  implements MigrationInterface
{
  name = 'AddSpocStateNotificationEvents1758800100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'rvsk_portal.notification_config';

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
        code: 'SPOC_STATE_ASSIGNED',
        name: 'SPOC Assigned to State',
        desc: 'Sent to a SPOC when a state is newly assigned to them.',
        recipient: 'CUSTOM',
        subject: 'You have been assigned to {{state_name}}',
        body: '<p>Dear {{spoc_name}},</p><p>You have been assigned as the SPOC for <strong>{{state_name}}</strong> by {{assigned_by_name}}. All grievances for this state are now your responsibility.</p><p>View them at <a href="{{portal_url}}">{{portal_url}}</a>.</p>',
        tokens:
          'spoc_name,state_name,assigned_by_name,portal_url,brand_name,support_email',
      },
      {
        code: 'SPOC_STATE_REASSIGNED',
        name: 'SPOC Reassigned to State',
        desc: 'Sent to the new SPOC (and, for awareness, the previous SPOC) when a state is reassigned.',
        recipient: 'CUSTOM',
        subject: 'You are now the SPOC for {{state_name}}',
        body: '<p>Dear {{spoc_name}},</p><p><strong>{{state_name}}</strong> has been reassigned to you{{previous_spoc_clause}} by {{assigned_by_name}}. All existing and future grievances for this state are now visible to you.</p><p>View them at <a href="{{portal_url}}">{{portal_url}}</a>.</p>',
        tokens:
          'spoc_name,state_name,previous_spoc_name,previous_spoc_clause,assigned_by_name,portal_url,brand_name,support_email',
      },
    ];

    for (const e of events) {
      await queryRunner.query(
        `INSERT INTO ${table}
           (event_code, event_name, description, recipient_type, recipient_value,
            subject_template, body_template, default_subject, default_body, allowed_tokens)
         VALUES ($1,$2,$3,$4,NULL,$5,$6,$5,$6,$7)
         ON CONFLICT (event_code) DO NOTHING`,
        [e.code, e.name, e.desc, e.recipient, e.subject, e.body, e.tokens],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM rvsk_portal.notification_config
        WHERE event_code IN ('SPOC_STATE_ASSIGNED', 'SPOC_STATE_REASSIGNED')`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-NOTIFY-EMAIL-003 — include the temporary password in the USER_CREATED
 * welcome email.
 *
 * The USER_CREATED event was seeded (1758700000000-CreateNotificationConfig)
 * before the temp password was passed into the notify context. This migration
 * updates the existing row so the welcome email can render {{temp_password}}:
 *   - adds the token to `allowed_tokens` (so template validation accepts it)
 *   - refreshes `default_body`/`default_subject` (factory defaults) to include it
 *   - refreshes the live `subject_template`/`body_template` ONLY when the admin
 *     has NOT customized the event (is_customized = false), so admin edits are
 *     never clobbered.
 */
export class AddTempPasswordToUserCreated1758900300000
  implements MigrationInterface
{
  name = 'AddTempPasswordToUserCreated1758900300000';

  private static readonly SUBJECT =
    'Welcome to {{brand_name}} — Your account is ready';
  private static readonly BODY =
    '<p>Dear {{user_name}},</p><p>Your {{brand_name}} account has been created.</p><p><strong>User ID:</strong> {{user_id}}<br/><strong>Temporary Password:</strong> {{temp_password}}</p><p>Please sign in at <a href="{{portal_url}}">{{portal_url}}</a> and change your password on first login.</p>';
  private static readonly TOKENS =
    'user_name,user_id,temp_password,portal_url,brand_name';

  // Prior (pre-temp-password) defaults, used to restore on down().
  private static readonly OLD_BODY =
    '<p>Dear {{user_name}},</p><p>Your {{brand_name}} account has been created.</p><p><strong>User ID:</strong> {{user_id}}</p><p>Please sign in at <a href="{{portal_url}}">{{portal_url}}</a> and change your password on first login.</p>';
  private static readonly OLD_TOKENS = 'user_name,user_id,portal_url,brand_name';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'rvsk_portal.notification_config';
    const C = AddTempPasswordToUserCreated1758900300000;

    // Always refresh allowed tokens + factory defaults.
    await queryRunner.query(
      `UPDATE ${table}
          SET allowed_tokens = $1,
              default_subject = $2,
              default_body = $3,
              updated_at = NOW()
        WHERE event_code = 'USER_CREATED'`,
      [C.TOKENS, C.SUBJECT, C.BODY],
    );

    // Refresh the live template only if the admin has not customized it.
    await queryRunner.query(
      `UPDATE ${table}
          SET subject_template = $1,
              body_template = $2,
              updated_at = NOW()
        WHERE event_code = 'USER_CREATED'
          AND COALESCE(is_customized, FALSE) = FALSE`,
      [C.SUBJECT, C.BODY],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'rvsk_portal.notification_config';
    const C = AddTempPasswordToUserCreated1758900300000;

    await queryRunner.query(
      `UPDATE ${table}
          SET allowed_tokens = $1,
              default_subject = $2,
              default_body = $3,
              updated_at = NOW()
        WHERE event_code = 'USER_CREATED'`,
      [C.OLD_TOKENS, C.SUBJECT, C.OLD_BODY],
    );

    await queryRunner.query(
      `UPDATE ${table}
          SET subject_template = $1,
              body_template = $2,
              updated_at = NOW()
        WHERE event_code = 'USER_CREATED'
          AND COALESCE(is_customized, FALSE) = FALSE`,
      [C.SUBJECT, C.OLD_BODY],
    );
  }
}

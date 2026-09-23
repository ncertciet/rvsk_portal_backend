import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RVSK-NOTIFY-EMAIL-003 — email_layout (shared branding).
 *
 * A single active DEFAULT record whose header (logo + brand) and footer wrap
 * every event body at render time. Seeded from branding env values; the Super
 * Admin can edit it without a redeploy. Editing it re-brands all events.
 */
export class CreateEmailLayout1758700200000 implements MigrationInterface {
  name = 'CreateEmailLayout1758700200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';
    const table = `${schema}.email_layout`;

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          VARCHAR(60) NOT NULL DEFAULT 'DEFAULT',
        logo_url      VARCHAR(500),
        brand_name    VARCHAR(120),
        primary_color VARCHAR(20),
        header_html   TEXT,
        footer_html   TEXT,
        support_email VARCHAR(255),
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by    UUID
      )
    `);

    // Seed a single DEFAULT active layout. Concrete branding is applied at
    // render time from env when these columns are null, so we seed minimal.
    await queryRunner.query(
      `INSERT INTO ${table} (name, brand_name, primary_color, footer_html, is_active)
       SELECT 'DEFAULT', 'RVSK Portal', '#0b5394',
              'This is an automated message from the RVSK Portal. Please do not reply.', TRUE
       WHERE NOT EXISTS (SELECT 1 FROM ${table})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = 'rvsk_portal';
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}.email_layout`);
  }
}

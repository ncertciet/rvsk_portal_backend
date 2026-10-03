import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * VSK Management — Event Management for RVSK/Super Admin.
 *
 * Creates vsk_event (parent) and vsk_event_image (children). Events are
 * distinct from the per-state VSK gallery: they carry a name, date / date range,
 * description, multiple captioned images, a chosen cover image, and a publish
 * flag. Only published events are shown on the public portal.
 */
export class CreateVskEvents1759000100000 implements MigrationInterface {
  name = 'CreateVskEvents1759000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rvsk_portal.vsk_event (
        id              uuid PRIMARY KEY,
        name            varchar(300) NOT NULL,
        description     text,
        start_date      date NOT NULL,
        end_date        date,
        cover_image_id  uuid,
        is_published    boolean NOT NULL DEFAULT false,
        published_at    timestamptz,
        is_active       boolean NOT NULL DEFAULT true,
        created_by      uuid,
        created_at      timestamptz,
        updated_by      uuid,
        updated_at      timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rvsk_portal.vsk_event_image (
        id            uuid PRIMARY KEY,
        event_id      uuid NOT NULL REFERENCES rvsk_portal.vsk_event(id) ON DELETE CASCADE,
        image_url     varchar(500) NOT NULL,
        file_path     varchar(500),
        caption       varchar(500),
        display_order int NOT NULL DEFAULT 0,
        is_active     boolean NOT NULL DEFAULT true,
        created_at    timestamptz
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_vsk_event_image_event
         ON rvsk_portal.vsk_event_image (event_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_vsk_event_published
         ON rvsk_portal.vsk_event (is_published, is_active)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rvsk_portal.vsk_event_image`);
    await queryRunner.query(`DROP TABLE IF EXISTS rvsk_portal.vsk_event`);
  }
}

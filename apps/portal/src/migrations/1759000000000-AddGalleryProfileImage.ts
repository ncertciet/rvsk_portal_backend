import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * VSK Management — allow a State Admin to mark one gallery image as the State's
 * VSK Profile Image (shown in the State Profile slider on the RVSK Portal).
 *
 * Adds a boolean `is_profile_image` flag to vsk_gallery_images. A partial unique
 * index enforces at most one active profile image per state.
 */
export class AddGalleryProfileImage1759000000000 implements MigrationInterface {
  name = 'AddGalleryProfileImage1759000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE rvsk_portal.vsk_gallery_images
         ADD COLUMN IF NOT EXISTS is_profile_image boolean NOT NULL DEFAULT false`,
    );
    // At most one profile image per state (only counts active rows).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_gallery_profile_per_state
         ON rvsk_portal.vsk_gallery_images (state_code)
        WHERE is_profile_image = true AND is_active = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS rvsk_portal.ux_gallery_profile_per_state`,
    );
    await queryRunner.query(
      `ALTER TABLE rvsk_portal.vsk_gallery_images
         DROP COLUMN IF EXISTS is_profile_image`,
    );
  }
}

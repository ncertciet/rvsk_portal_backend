import { Entity, PrimaryColumn, Column, BeforeInsert } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * RVSK-NOTIFY-EMAIL-003 — shared branding layout (single active DEFAULT row).
 * Wraps every event body with logo/header/footer at render time.
 */
@Entity({ name: 'email_layout', schema: 'rvsk_portal' })
export class EmailLayout {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'name', length: 60, default: 'DEFAULT' })
  name: string;

  @Column({ name: 'logo_url', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ name: 'brand_name', length: 120, nullable: true })
  brandName: string | null;

  @Column({ name: 'primary_color', length: 20, nullable: true })
  primaryColor: string | null;

  @Column({ name: 'header_html', type: 'text', nullable: true })
  headerHtml: string | null;

  @Column({ name: 'footer_html', type: 'text', nullable: true })
  footerHtml: string | null;

  @Column({ name: 'support_email', length: 255, nullable: true })
  supportEmail: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @BeforeInsert()
  setDefaults() {
    if (!this.id) {
      this.id = uuidv4();
    }
    if (!this.updatedAt) {
      this.updatedAt = new Date();
    }
  }
}

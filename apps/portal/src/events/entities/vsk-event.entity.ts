import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VskEventImage } from './vsk-event-image.entity';

/**
 * An RVSK/Super-Admin managed event (e.g. "National VSK Workshop"). Separate
 * from the per-state VSK gallery. Supports single- or multi-day events, a set
 * of images with captions, a cover image, and a publish workflow — only
 * published events appear on the public portal.
 */
@Entity({ name: 'vsk_event', schema: 'rvsk_portal' })
export class VskEvent {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'name', nullable: false, length: 300 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'start_date', type: 'date', nullable: false })
  startDate: string;

  /** Null for single-day events. */
  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  /** FK to the chosen cover image (nullable until one is selected). */
  @Column({ name: 'cover_image_id', type: 'uuid', nullable: true })
  coverImageId: string | null;

  @Column({ name: 'is_published', type: 'boolean', nullable: false, default: false })
  isPublished: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @OneToMany(() => VskEventImage, (img) => img.event, { cascade: false })
  images: VskEventImage[];

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date;

  @BeforeInsert()
  setDefaults() {
    if (!this.id) this.id = uuidv4();
    const now = new Date();
    this.createdAt = now;
    this.updatedAt = now;
  }

  @BeforeUpdate()
  setUpdatedAt() {
    this.updatedAt = new Date();
  }
}

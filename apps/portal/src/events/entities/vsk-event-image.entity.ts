import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VskEvent } from './vsk-event.entity';

/**
 * A single photograph attached to a {@link VskEvent}, with an optional caption.
 */
@Entity({ name: 'vsk_event_image', schema: 'rvsk_portal' })
export class VskEventImage {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @ManyToOne(() => VskEvent, (event) => event.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: VskEvent;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  /** Public URL under /api/v1/uploads/events/... */
  @Column({ name: 'image_url', nullable: false, length: 500 })
  imageUrl: string;

  /** Relative storage path (used for deletes). */
  @Column({ name: 'file_path', nullable: true, length: 500 })
  filePath: string;

  @Column({ name: 'caption', nullable: true, length: 500 })
  caption: string;

  @Column({ name: 'display_order', type: 'int', nullable: false, default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date;

  @BeforeInsert()
  setDefaults() {
    if (!this.id) this.id = uuidv4();
    this.createdAt = new Date();
  }
}

import {
  Entity,
  PrimaryColumn,
  Column,
  BeforeInsert,
} from 'typeorm';

@Entity({ name: 'vsk_gallery_images', schema: 'rvsk_portal' })
export class GalleryImage {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'state_code', nullable: false, length: 10 })
  stateCode: string;

  @Column({ name: 'file_name', nullable: false, length: 255 })
  fileName: string;

  @Column({ name: 'file_path', nullable: false, length: 500 })
  filePath: string;

  @Column({ name: 'thumbnail_path', nullable: true, length: 500 })
  thumbnailPath: string;

  @Column({ name: 'caption', nullable: true, length: 500 })
  caption: string;

  @Column({ name: 'file_type', nullable: false, length: 50 })
  fileType: string;

  @Column({ name: 'file_size', type: 'bigint', nullable: false })
  fileSize: number;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: false })
  uploadedBy: string;

  @Column({ name: 'uploaded_at', type: 'timestamptz', nullable: false })
  uploadedAt: Date;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  // Virtual properties for backward compatibility with service code
  get title(): string {
    return this.caption || this.fileName;
  }

  get storedPath(): string {
    return this.filePath;
  }

  get imageUrl(): string {
    return `/api/v1/gallery/files/${this.fileName}`;
  }

  get displayOrder(): number {
    return 0; // PG table has no display_order column
  }

  get createdAt(): Date {
    return this.uploadedAt;
  }

  @BeforeInsert()
  setUploadedAt() {
    if (!this.uploadedAt) {
      this.uploadedAt = new Date();
    }
  }
}

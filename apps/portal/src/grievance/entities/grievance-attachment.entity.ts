import {
  Entity,
  Column,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';

@Entity({ name: 'grievance_attachments', schema: 'rvsk_portal' })
export class GrievanceAttachment {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
  })
  id: string;

  @Column({
    name: 'grievance_id',
    nullable: false,
    type: 'uuid',
  })
  grievanceId: string;

  @Column({ name: 'file_name', nullable: false, length: 255 })
  originalFileName: string;

  @Column({ name: 'file_path', nullable: false, length: 500 })
  storedPath: string;

  @Column({ name: 'file_type', nullable: true, length: 50 })
  contentType: string;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: number;

  @Column({
    name: 'uploaded_by',
    nullable: false,
    type: 'uuid',
  })
  uploadedBy: string;

  @Column({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;

  @BeforeInsert()
  setUploadedAt() {
    this.uploadedAt = new Date();
  }
}

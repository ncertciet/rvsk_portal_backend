import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PageMaster } from './page-master.entity';

@Entity({ name: 'user_page_overrides_v2', schema: 'rvsk_portal' })
export class UserPageOverrideV2 {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'page_id', type: 'uuid' })
  pageId: string;

  @ManyToOne(() => PageMaster, { eager: false })
  @JoinColumn({ name: 'page_id' })
  page: PageMaster;

  @Column({ name: 'can_view', type: 'boolean', nullable: true })
  canView: boolean | null;

  @Column({ name: 'can_edit', type: 'boolean', nullable: true })
  canEdit: boolean | null;

  @Column({ name: 'can_export', type: 'boolean', nullable: true })
  canExport: boolean | null;

  @Column({ name: 'can_delete', type: 'boolean', nullable: true })
  canDelete: boolean | null;

  @Column({ name: 'updated_by', nullable: true, type: 'uuid' })
  updatedBy: string;
}

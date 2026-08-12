import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { PageMaster } from './page-master.entity';

@Entity({ name: 'role_page_defaults_v2', schema: 'rvsk_portal' })
@Unique(['role', 'pageId'])
export class RolePageDefaultV2 {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'role', nullable: false, length: 50 })
  role: string;

  @Column({ name: 'page_id', type: 'uuid' })
  pageId: string;

  @ManyToOne(() => PageMaster, { eager: false })
  @JoinColumn({ name: 'page_id' })
  page: PageMaster;

  @Column({ name: 'can_view', type: 'boolean', default: true })
  canView: boolean;

  @Column({ name: 'can_edit', type: 'boolean', default: false })
  canEdit: boolean;

  @Column({ name: 'can_export', type: 'boolean', default: false })
  canExport: boolean;

  @Column({ name: 'can_delete', type: 'boolean', default: false })
  canDelete: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ModuleMaster } from './module-master.entity';

@Entity({ name: 'page_master', schema: 'rvsk_portal' })
export class PageMaster {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'module_id', type: 'uuid' })
  moduleId: string;

  @ManyToOne(() => ModuleMaster, { eager: false })
  @JoinColumn({ name: 'module_id' })
  module: ModuleMaster;

  @Column({ name: 'page_code', nullable: false, length: 50 })
  pageCode: string;

  @Column({ name: 'page_name', nullable: false, length: 100 })
  pageName: string;

  @Column({ name: 'route_path', nullable: false, unique: true, length: 200 })
  routePath: string;

  @Column({ name: 'icon', nullable: true, length: 50 })
  icon: string;

  @Column({ name: 'display_order', nullable: false })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'module_master', schema: 'rvsk_portal' })
export class ModuleMaster {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'module_code', unique: true, nullable: false, length: 30 })
  moduleCode: string;

  @Column({ name: 'module_name', nullable: false, length: 100 })
  moduleName: string;

  @Column({ name: 'icon', nullable: true, length: 50 })
  icon: string;

  @Column({ name: 'display_order', nullable: false })
  displayOrder: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @Column({ name: 'created_by', nullable: true, type: 'uuid' })
  createdBy: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

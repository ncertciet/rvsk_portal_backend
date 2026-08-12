import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'grievance_categories', schema: 'rvsk_portal' })
export class GrievanceCategory {
  @PrimaryColumn({ name: 'code', length: 50 })
  code: string;

  @Column({ name: 'label', nullable: false, length: 200 })
  label: string;

  @Column({ name: 'parent_code', nullable: true, length: 50 })
  parentCode: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}

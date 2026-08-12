import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VskPmuHeader } from './vsk-pmu-header.entity';

@Entity({ name: 'vsk_pmu_role_structure', schema: 'rvsk_portal' })
export class VskPmuRoleStructure {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @ManyToOne(() => VskPmuHeader, (header) => header.roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'header_id' })
  header: VskPmuHeader;

  @Column({ name: 'header_id', type: 'uuid' })
  headerId: string;

  @Column({ name: 'role_name', nullable: true, length: 200 })
  roleName: string;

  @Column({ name: 'custom_role_name', nullable: true, length: 200 })
  customRoleName: string;

  @Column({ name: 'no_of_members', nullable: true })
  noOfMembers: number;

  // Audit
  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date;

  @BeforeInsert()
  setDefaults() {
    if (!this.id) {
      this.id = uuidv4();
    }
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  setUpdatedAt() {
    this.updatedAt = new Date();
  }
}

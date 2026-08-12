import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VskPmuRoleStructure } from './vsk-pmu-role-structure.entity';

@Entity({ name: 'vsk_pmu_header', schema: 'rvsk_portal' })
export class VskPmuHeader {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'state_code', nullable: false, unique: true, length: 2 })
  stateCode: string;

  @Column({ name: 'pmu_team_type', nullable: true, length: 100 })
  pmuTeamType: string;

  @Column({ name: 'total_team_members', nullable: true })
  totalTeamMembers: number;

  @OneToMany(() => VskPmuRoleStructure, (role) => role.header, {
    cascade: true,
    eager: true,
  })
  roles: VskPmuRoleStructure[];

  // Audit
  @Column({ name: 'created_by', nullable: true, type: 'uuid' })
  createdBy: string;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: true })
  createdAt: Date;

  @Column({ name: 'updated_by', nullable: true, type: 'uuid' })
  updatedBy: string;

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

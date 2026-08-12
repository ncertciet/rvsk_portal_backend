import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { VskSoftwareItem } from './vsk-software-item.entity';

@Entity({ name: 'vsk_software_header', schema: 'rvsk_portal' })
export class VskSoftwareHeader {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'state_code', nullable: false, unique: true, length: 2 })
  stateCode: string;

  @Column({ name: 'starter_pack', type: 'boolean', nullable: true, default: false })
  starterPack: boolean;

  @Column({ name: 'server_type', nullable: true, length: 100 })
  serverType: string;

  @OneToMany(() => VskSoftwareItem, (item) => item.header, {
    cascade: true,
    eager: true,
  })
  items: VskSoftwareItem[];

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
    if (this.starterPack == null) this.starterPack = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  setUpdatedAt() {
    this.updatedAt = new Date();
  }
}

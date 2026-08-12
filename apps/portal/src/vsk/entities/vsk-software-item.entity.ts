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
import { VskSoftwareHeader } from './vsk-software-header.entity';

@Entity({ name: 'vsk_software_item', schema: 'rvsk_portal' })
export class VskSoftwareItem {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @ManyToOne(() => VskSoftwareHeader, (header) => header.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'header_id' })
  header: VskSoftwareHeader;

  @Column({ name: 'header_id', type: 'uuid' })
  headerId: string;

  @Column({ name: 'software_name', nullable: true, length: 200 })
  softwareName: string;

  @Column({ name: 'custom_software_name', nullable: true, length: 200 })
  customSoftwareName: string;

  @Column({ name: 'software_type', nullable: true, length: 20 })
  softwareType: string;

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

import {
  Entity,
  PrimaryColumn,
  Column,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity({ name: 'vsk_infra_hardware', schema: 'rvsk_portal' })
export class VskInfraHardware {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'state_code', nullable: false, unique: true, length: 2 })
  stateCode: string;

  // Room
  @Column({ name: 'room_length', type: 'decimal', precision: 10, scale: 2, nullable: true })
  roomLength: number;

  @Column({ name: 'room_width', type: 'decimal', precision: 10, scale: 2, nullable: true })
  roomWidth: number;

  @Column({ name: 'room_height', type: 'decimal', precision: 10, scale: 2, nullable: true })
  roomHeight: number;

  @Column({ name: 'room_image_url', nullable: true, length: 500 })
  roomImageUrl: string;

  // Screen
  @Column({ name: 'screen_length', type: 'decimal', precision: 10, scale: 2, nullable: true })
  screenLength: number;

  @Column({ name: 'screen_height', type: 'decimal', precision: 10, scale: 2, nullable: true })
  screenHeight: number;

  @Column({ name: 'screen_image_url', nullable: true, length: 500 })
  screenImageUrl: string;

  // Workstations
  @Column({ name: 'workstation_count', nullable: true })
  workstationCount: number;

  @Column({ name: 'workstation_image_url', nullable: true, length: 500 })
  workstationImageUrl: string;

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

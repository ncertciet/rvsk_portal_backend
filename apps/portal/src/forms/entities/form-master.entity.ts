import {
  Entity,
  Column,
  PrimaryColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

@Entity({ name: 'form_master', schema: 'rvsk_portal' })
export class FormMaster {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'title', nullable: false, length: 500 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'instructions', type: 'text', nullable: true })
  instructions: string;

  @Column({ name: 'status', nullable: false, length: 20, default: 'DRAFT' })
  status: string;

  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate: Date;

  @Column({ name: 'publish_date', type: 'timestamptz', nullable: true })
  publishDate: Date;

  @Column({ name: 'created_by', nullable: false, type: 'uuid' })
  createdBy: string;

  @Column({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @Column({ name: 'updated_by', nullable: true, type: 'uuid' })
  updatedBy: string;

  @Column({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;

  @BeforeInsert()
  setCreatedDate() {
    this.createdDate = new Date();
    this.updatedDate = new Date();
  }

  @BeforeUpdate()
  setUpdatedDate() {
    this.updatedDate = new Date();
  }
}

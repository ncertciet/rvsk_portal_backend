import {
  Entity,
  Column,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';

@Entity({ name: 'form_question', schema: 'rvsk_portal' })
export class FormQuestion {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  @Column({ name: 'form_id', type: 'uuid' })
  formId: string;

  @Column({ name: 'question_text', nullable: false, length: 1000 })
  questionText: string;

  @Column({ name: 'field_type', nullable: false, length: 20 })
  fieldType: string;

  @Column({
    name: 'is_required',
    type: 'boolean',
    default: false,
  })
  isRequired: boolean;

  @Column({ name: 'help_text', nullable: true, length: 500 })
  helpText: string;

  @Column({ name: 'options_json', type: 'text', nullable: true })
  optionsJson: string;

  @Column({ name: 'display_order', type: 'integer' })
  displayOrder: number;

  @Column({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @BeforeInsert()
  setCreatedDate() {
    this.createdDate = new Date();
  }
}

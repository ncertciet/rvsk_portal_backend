import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
  MaxLength,
} from 'class-validator';

export class QuestionDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  questionText: string;

  @IsNotEmpty()
  @IsString()
  @IsIn([
    'SHORT_TEXT',
    'LONG_TEXT',
    'NUMBER',
    'DATE',
    'DROPDOWN',
    'RADIO',
    'CHECKBOX',
    'FILE',
  ])
  fieldType: string;

  @IsOptional()
  isRequired?: boolean | number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  helpText?: string;

  @IsOptional()
  @IsString()
  optionsJson?: string;
}

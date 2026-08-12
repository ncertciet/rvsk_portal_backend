import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AnswerDto } from './answer.dto';

export class SubmitResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}

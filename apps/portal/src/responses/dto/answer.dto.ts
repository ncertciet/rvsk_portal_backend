import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AnswerDto {
  @IsNotEmpty()
  @IsString()
  questionId: string;

  @IsOptional()
  @IsString()
  answerText?: string;
}

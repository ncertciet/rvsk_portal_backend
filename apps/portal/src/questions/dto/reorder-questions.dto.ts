import { IsArray, IsNotEmpty, IsString, ArrayMinSize } from 'class-validator';

export class ReorderQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  orderedIds: string[];
}

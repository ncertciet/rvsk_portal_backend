import { IsArray, ArrayMinSize, ArrayMaxSize, IsOptional, IsDateString, IsString } from 'class-validator';

export class PublishDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(36)
  @IsString({ each: true })
  stateCodes: string[];

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

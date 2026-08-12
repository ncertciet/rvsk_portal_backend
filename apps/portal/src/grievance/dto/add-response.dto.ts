import { IsNotEmpty, IsString } from 'class-validator';

export class AddResponseDto {
  @IsNotEmpty()
  @IsString()
  responseText: string;
}

import { IsArray, ArrayMinSize, IsOptional, IsDateString, Matches } from 'class-validator';

export class PublishDto {
  /**
   * State keys (bigint as string) to assign the form to. Matches
   * portal_users.state_key / vw_state_master.state_key.
   */
  @IsArray()
  @ArrayMinSize(1)
  @Matches(/^\d+$/, { each: true, message: 'each stateKey must be a numeric key' })
  stateKeys: string[];

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

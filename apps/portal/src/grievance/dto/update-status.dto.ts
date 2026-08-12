import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateStatusDto {
  @IsOptional()
  @IsString()
  newStatus?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  /**
   * Returns the effective status value.
   * Frontend sends "status" field, but backend DTO originally used "newStatus".
   * This getter provides compatibility with both.
   */
  get effectiveStatus(): string {
    return this.newStatus || this.status || '';
  }
}

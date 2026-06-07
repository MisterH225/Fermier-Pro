import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class ListFeedMovementsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  feedTypeId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

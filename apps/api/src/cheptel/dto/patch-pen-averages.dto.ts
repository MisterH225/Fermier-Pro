import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, Min } from "class-validator";

export class PatchPenAveragesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  averageWeightKg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  averageAgeDays?: number | null;
}

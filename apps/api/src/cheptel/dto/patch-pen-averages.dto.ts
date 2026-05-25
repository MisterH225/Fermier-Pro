import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";

export class PatchPenAveragesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  averageWeightKg?: number | null;

  /** Âge moyen en SEMAINES entières (0 — 104). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(104)
  averageAgeWeeks?: number | null;
}

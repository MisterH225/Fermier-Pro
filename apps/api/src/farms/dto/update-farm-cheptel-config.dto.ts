import { FarmLivestockMode } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min
} from "class-validator";

export class UpdateFarmCheptelConfigDto {
  @IsOptional()
  @IsEnum(FarmLivestockMode)
  livestockMode?: FarmLivestockMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  housingBuildingsCount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  housingPensPerBuilding?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  housingMaxPigsPerPen?: number | null;
}

import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export class CompleteOnboardingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  farmName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  speciesFocus?: string;

  @IsIn(["gps", "manual"])
  locationSource!: "gps" | "manual";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  femaleBreeders!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  maleBreeders!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  starterHeadcount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  fatteningHeadcount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  buildingsCount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  pensPerBuilding!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  maxPigsPerPen!: number;

  /** Âge moyen estimé (semaines) pour les animaux de production créés en masse. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(104)
  productionEstimatedAgeWeeks?: number;
}

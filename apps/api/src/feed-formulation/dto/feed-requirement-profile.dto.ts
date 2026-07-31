import { ProductionStage } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return Boolean(value);
}

export class CreateFeedRequirementProfileDto {
  @IsEnum(ProductionStage)
  stage!: ProductionStage;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  minCrudeProteinPct!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  maxCrudeProteinPct?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minMetabolizableEnergyKcal!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxMetabolizableEnergyKcal?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  minLysinePct!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  minMethioninePct!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  minCalciumPct!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  maxCalciumPct?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  minPhosphorusPct!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  maxFiberPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  minLysinePerMcal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  targetDailyIntakeKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFeedRequirementProfileDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  minCrudeProteinPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  maxCrudeProteinPct?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minMetabolizableEnergyKcal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxMetabolizableEnergyKcal?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  minLysinePct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  minMethioninePct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  minCalciumPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  maxCalciumPct?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  minPhosphorusPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  maxFiberPct?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  minLysinePerMcal?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  targetDailyIntakeKg?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}

export class ListFeedRequirementProfilesQueryDto {
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeInactive?: boolean;

  @IsOptional()
  @IsEnum(ProductionStage)
  stage?: ProductionStage;
}

import { FeedIngredientCategory } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return Boolean(value);
}

const PCT_MIN = 0;
const PCT_MAX = 100;

export class CreateFeedIngredientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  canonicalName!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  aliases?: string[];

  @IsEnum(FeedIngredientCategory)
  category!: FeedIngredientCategory;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  crudeProteinPct!: number;

  /** kcal/kg — ≥ 0 (minéraux / additifs peuvent être à 0). */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  metabolizableEnergyKcal!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  lysinePct!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  methioninePct!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  calciumPct!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  phosphorusPct!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  crudeFiberPct!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  fatPct!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  dryMatterPct!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** Additif à taux fixe (CMV, sel…) — hors optimisation LP. */
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isPremix?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  iconKey?: string | null;
}

export class UpdateFeedIngredientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  canonicalName?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  aliases?: string[];

  @IsOptional()
  @IsEnum(FeedIngredientCategory)
  category?: FeedIngredientCategory;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  crudeProteinPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  metabolizableEnergyKcal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  lysinePct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  methioninePct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  calciumPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  phosphorusPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  crudeFiberPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  fatPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(PCT_MIN)
  @Max(PCT_MAX)
  dryMatterPct?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isPremix?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  iconKey?: string | null;

  /** Marque l'intrant comme relu / validé (renseigne reviewedAt). */
  @IsOptional()
  @IsBoolean()
  markReviewed?: boolean;
}

export class ListFeedIngredientsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(FeedIngredientCategory)
  category?: FeedIngredientCategory;

  /** Si true, inclut les intrants désactivés (console admin). */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => toOptionalBoolean(value))
  includeInactive?: boolean;
}

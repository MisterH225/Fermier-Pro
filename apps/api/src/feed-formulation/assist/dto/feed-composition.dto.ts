import { ProductionStage, SavedCompositionSource } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

export class ChatMessageDto {
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;
}

export class AssistFeedCompositionDto {
  @IsString()
  @MinLength(1)
  farmId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];

  @IsOptional()
  @IsEnum(ProductionStage)
  stageHint?: ProductionStage;

  @IsOptional()
  @IsString()
  millId?: string;
}

export class FormulateFeedCompositionDto {
  @IsString()
  @MinLength(1)
  farmId!: string;

  @IsEnum(ProductionStage)
  stage!: ProductionStage;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100_000)
  animalCount!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(500)
  avgWeightKg!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(520)
  avgAgeWeeks?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(365)
  durationDays!: number;

  @IsOptional()
  @IsString()
  millId?: string;
}

/** Ligne de ration partagée (save + explain). */
export class RationLineDto {
  @IsString()
  @MinLength(1)
  feedIngredientId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  canonicalName?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantityKg!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  proportionPct!: number;

  /** Présent sur la réponse formulate — stocké tel quel à la sauvegarde. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costContribution?: number;
}

export class SaveCompositionDto {
  @IsString()
  @MinLength(1)
  farmId!: string;

  @IsEnum(ProductionStage)
  stage!: ProductionStage;

  @IsEnum(SavedCompositionSource)
  source!: SavedCompositionSource;

  @IsObject()
  inputParams!: Record<string, unknown>;

  /**
   * Lignes de ration (tableau). `@IsObject()` de class-validator rejette les
   * arrays — le mobile envoie toujours un `RationLineDto[]`.
   */
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => RationLineDto)
  ration!: RationLineDto[];

  @IsOptional()
  @IsObject()
  nutritionResult?: Record<string, unknown>;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalCostXof!: number;

  @IsOptional()
  @IsString()
  millProfileId?: string;

  @IsOptional()
  @IsBoolean()
  isTheoretical?: boolean;
}

export class RequestVetReviewDto {
  @IsOptional()
  @IsString()
  /** UserId du véto associé ; si omis, premier véto membre de la ferme. */
  veterinarianUserId?: string;
}

export class VetReviewCompositionDto {
  @IsIn(["approve", "request_changes"])
  decision!: "approve" | "request_changes";

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;
}

/**
 * Ajustement véto — passe TOUJOURS par le moteur (substitution d'intrant).
 * Aucune quantité saisie : remove + add uniquement.
 * Note : adjust_constraint n'est pas supporté par le moteur actuel.
 */
export class ProposeCompositionAdjustmentDto {
  @IsString()
  @MinLength(1)
  removeIngredientId!: string;

  @IsString()
  @MinLength(1)
  addIngredientId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  addPricePerKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  addMaxAvailableKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

/** Producteur applique une version proposée (legacy : via message chat). */
export class ApplyCompositionAdjustmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  messageId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  proposalId?: string;
}

/** Producteur refuse une proposition d'ajustement. */
export class RejectCompositionAdjustmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

/** @deprecated alias — préférer `RationLineDto`. */
export class ExplainRationLineDto extends RationLineDto {}

export class ExplainNutritionDto {
  @Type(() => Number)
  @IsNumber()
  crudeProteinPct!: number;

  @Type(() => Number)
  @IsNumber()
  metabolizableEnergyKcal!: number;

  @Type(() => Number)
  @IsNumber()
  lysinePct!: number;

  @Type(() => Number)
  @IsNumber()
  methioninePct!: number;

  @Type(() => Number)
  @IsNumber()
  calciumPct!: number;

  @Type(() => Number)
  @IsNumber()
  phosphorusPct!: number;

  @Type(() => Number)
  @IsNumber()
  crudeFiberPct!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lysinePerMcal?: number | null;
}

export class ExplainDeviationDto {
  @IsString()
  @MinLength(1)
  nutrient!: string;

  @IsString()
  target!: string;

  @Type(() => Number)
  @IsNumber()
  actual!: number;

  @IsBoolean()
  withinBounds!: boolean;
}

/**
 * Demande d'explication structurée d'une ration déjà calculée.
 * L'IA (Gemini) commente les données — aucun chiffre inventé.
 */
export class ExplainFeedCompositionDto {
  @IsString()
  @MinLength(1)
  farmId!: string;

  @IsEnum(ProductionStage)
  stage!: ProductionStage;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100_000)
  animalCount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(500)
  avgWeightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(520)
  avgAgeWeeks?: number;

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ExplainRationLineDto)
  ration!: ExplainRationLineDto[];

  @ValidateNested()
  @Type(() => ExplainNutritionDto)
  nutritionResult!: ExplainNutritionDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ExplainDeviationDto)
  deviations?: ExplainDeviationDto[];

  /** Si fourni : lit/écrit le cache SavedComposition.explanation. */
  @IsOptional()
  @IsString()
  savedCompositionId?: string;

  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

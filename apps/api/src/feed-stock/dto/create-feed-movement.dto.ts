import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { FeedMovementKind, FeedTypeUnit } from "@prisma/client";
import { CreateFeedTypeDto } from "./create-feed-type.dto";

export class CreateFeedMovementDto {
  @IsEnum(FeedMovementKind)
  kind!: FeedMovementKind;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  feedTypeId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateFeedTypeDto)
  newFeedType?: CreateFeedTypeDto;

  /** Quantité saisie (entrée stock) — interprétée selon `quantityUnit`. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000_001)
  @Max(1e9)
  quantityInput?: number;

  @IsOptional()
  @IsEnum(FeedTypeUnit)
  quantityUnit?: FeedTypeUnit;

  /** Surcharge ponctuelle du poids sac (kg). Met aussi à jour le type si fourni. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(500)
  weightPerBagKg?: number;

  /** Inventaire terrain : sacs restants comptés. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e7)
  bagsCounted?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supplier?: string;

  /** Prix unitaire : interprété selon `priceBasis` (kg ou sac). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e9)
  unitPrice?: number;

  @IsOptional()
  @IsEnum(["kg", "sac"] as const)
  priceBasis?: "kg" | "sac";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

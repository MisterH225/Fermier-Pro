import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { FeedTypeUnit } from "@prisma/client";

export class UpdateFeedMovementDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  feedTypeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.000_001)
  @Max(1e9)
  quantityInput?: number;

  @IsOptional()
  @IsEnum(FeedTypeUnit)
  quantityUnit?: FeedTypeUnit;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(500)
  weightPerBagKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supplier?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e9)
  unitPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e12)
  totalCost?: number;

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

  /** Nombre de sacs comptés (contrôle de stock uniquement). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e6)
  bagsCounted?: number;
}

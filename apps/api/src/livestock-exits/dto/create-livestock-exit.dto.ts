import { LivestockExitKind } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateLivestockExitDto {
  @IsEnum(LivestockExitKind)
  kind!: LivestockExitKind;

  @IsOptional()
  @IsString()
  animalId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  /// Pour une bande : nombre de sujets concernes (defaut = effectif actuel).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  headcountAffected?: number;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  buyerName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e12)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  weightKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deathCause?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  symptoms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  carcassYieldNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  slaughterDestination?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  transferDestination?: string;

  @IsOptional()
  @IsString()
  toFarmId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

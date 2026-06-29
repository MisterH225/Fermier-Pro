import { HistoricalCategory, HistoricalMovementType } from "@prisma/client";
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

export class CreateQuickTotalDto {
  @IsEnum(HistoricalMovementType)
  movementType!: HistoricalMovementType;

  @IsEnum(HistoricalCategory)
  category!: HistoricalCategory;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(1e12)
  amount!: number;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

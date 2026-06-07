import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { PriceAlertFrequency } from "@prisma/client";

export class UpdateBuyerPriceAlertDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  animalCategory?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPricePerKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minWeightKg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  radiusKm?: number | null;

  @IsOptional()
  @IsEnum(PriceAlertFrequency)
  notificationFrequency?: PriceAlertFrequency;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

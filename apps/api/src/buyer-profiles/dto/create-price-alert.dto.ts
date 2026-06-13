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

export class CreateBuyerPriceAlertDto {
  @IsString()
  @MaxLength(40)
  animalCategory!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPricePerKg!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minWeightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  radiusKm?: number;

  @IsOptional()
  @IsEnum(PriceAlertFrequency)
  notificationFrequency?: PriceAlertFrequency;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

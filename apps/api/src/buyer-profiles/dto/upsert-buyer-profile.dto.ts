import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
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
import { BuyerType } from "@prisma/client";

export class UpsertBuyerProfileDto {
  @IsOptional()
  @IsEnum(BuyerType)
  buyerType?: BuyerType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  locationLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  homeLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  homeLongitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  searchRadiusKm?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  preferredCategories?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceRangeMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceRangeMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  typicalVolume?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  profilePhotoUrl?: string;

  @IsOptional()
  @IsBoolean()
  onboardingComplete?: boolean;
}

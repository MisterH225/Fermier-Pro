import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { MerchantSubscriptionPromoCodeType } from "@prisma/client";

export class AdminCreateMerchantPromoCodeDto {
  @IsEnum(MerchantSubscriptionPromoCodeType)
  type!: MerchantSubscriptionPromoCodeType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  percentOff?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  trialUnits?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

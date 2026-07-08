import { MarketplacePaymentMethod, MerchantSubscriptionTier } from "@prisma/client";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export class PatchMerchantOnboardingDto {
  @IsOptional()
  shopSkipped?: boolean;

  @IsOptional()
  productSkipped?: boolean;

  @IsOptional()
  onboardingComplete?: boolean;
}

export class ChooseMerchantSubscriptionDto {
  @IsEnum(MerchantSubscriptionTier)
  tier!: MerchantSubscriptionTier;

  @IsOptional()
  @IsEnum(MarketplacePaymentMethod)
  paymentMethod?: MarketplacePaymentMethod;

  /** Demande un essai gratuit si activé côté plateforme. */
  @IsOptional()
  startTrial?: boolean;

  /** Code marketing (essai / remise / promo) saisi par le commerçant. */
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  promoCode?: string;
}

export class ValidateMerchantPromoCodeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  code!: string;
}

export class CreateMerchantShopDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  locationLabel?: string;
}

export class UpdateMerchantShopDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  locationLabel?: string;
}

export class CreateMerchantProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsNumber()
  @Min(0.01)
  price!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @IsInt()
  @Min(0)
  stock!: number;
}

export class UpdateMerchantProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}

export class PurchaseMerchantProductDto {
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsEnum(MarketplacePaymentMethod)
  paymentMethod!: MarketplacePaymentMethod;
}

export class ConfirmMerchantPaymentDto {
  @IsString()
  providerRef!: string;
}

export class CreateMerchantCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateMerchantCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  isActive?: boolean;
}

export class DeleteMerchantProductAdminDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class OpenMerchantOrderDisputeDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class RespondMerchantOrderDisputeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  note!: string;
}

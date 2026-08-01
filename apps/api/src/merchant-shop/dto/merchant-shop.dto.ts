import {
  MarketplacePaymentMethod,
  MerchantKind,
  MerchantSubscriptionTier
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf
} from "class-validator";

export class PatchMerchantOnboardingDto {
  @IsOptional()
  shopSkipped?: boolean;

  @IsOptional()
  productSkipped?: boolean;

  @IsOptional()
  onboardingComplete?: boolean;

  /**
   * Sous-type commerçant. `mill` n'est accepté que si le flag `mills` est actif
   * pour l'utilisateur ; sinon le champ est ignoré / rejeté côté service.
   */
  @IsOptional()
  @IsEnum(MerchantKind)
  merchantKind?: MerchantKind;
}

/**
 * Mise à jour du profil commerçant (paramètres boutique / profil).
 * Le passage standard→mill n'efface aucune donnée existante.
 * Géolocalisation : mêmes champs que Farm (P-10) — résolution via GeoRollupService.
 */
export class PatchMerchantProfileDto {
  @IsOptional()
  @IsEnum(MerchantKind)
  merchantKind?: MerchantKind;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(120)
  locationCity?: string | null;
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

  /** Unité de vente (ex. kg, douzaine, sac). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unitLabel?: string;

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
  @IsString()
  @MaxLength(40)
  unitLabel?: string | null;

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

  /** Facture en attente — utile si la référence GeniusPay a changé après reprise checkout. */
  @IsOptional()
  @IsString()
  invoiceId?: string;
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

/** Rejet d’une re-soumission produit (retour en moderated_removed). */
export class RejectMerchantProductResubmissionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

/** Motif obligatoire pour archivage / hard-delete admin d’une boutique. */
export class ArchiveMerchantShopAdminDto {
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

export class ResolveMerchantOrderDisputeDto {
  @IsIn(["buyer", "seller"])
  decision!: "buyer" | "seller";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

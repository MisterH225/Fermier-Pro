import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import {
  MerchantPremiumBillingUnit,
  SanitaryAlertLevel,
  SanitaryAlertType
} from "@prisma/client";

export class RejectVetProfileAdminDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;
}

/** Assignation manuelle du département d'une ferme (superadmin). */
export class PatchFarmGeoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  departmentCode!: string;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  mapGeographicScope?: string;

  @IsOptional()
  mapCountryCodes?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  alertCaseThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  alertPeriodDays?: number;

  @IsOptional()
  @IsEnum(SanitaryAlertLevel)
  alertDefaultLevel?: SanitaryAlertLevel;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  adminNotifyEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  reportFrequencyDays?: number;

  /** Taux de commission marketplace prélevé sur l'acheteur (ex. 0.05 = 5 %). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  marketplaceCommissionRate?: number;

  /** Taux de commission marketplace prélevé sur le vendeur (ex. 0.05 = 5 %). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  sellerMarketplaceCommissionRate?: number;

  /** Taux de commission prélevé sur le montant versé au vétérinaire (ex. 0.05 = 5 %). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.99)
  vetCommissionRate?: number;

  /** Numéro support (appel mobile). Vide = fallback env `SUPPORT_PHONE`. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  supportPhone?: string | null;

  /** Lien Telegram (https://t.me/… ou @username). Vide = fallback env. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  supportTelegramUrl?: string | null;

  /** Seuil (XOF) de retrait auto-approuvé sans validation admin. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  withdrawalAutoApproveThreshold?: number;

  /** Écart total (kg) sous lequel acheteur/vendeur continuent sans arbitrage. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000)
  marketplaceWeightArbitrationMinDiffKg?: number;

  /** Écart total (kg) minimal pour arbitrage sur lot multi-animaux. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000)
  marketplaceWeightArbitrationCumulativeMinDiffKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  merchantPremiumPriceXof?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  merchantPremiumMaxShops?: number;

  @IsOptional()
  @IsEnum(MerchantPremiumBillingUnit)
  merchantPremiumBillingUnit?: MerchantPremiumBillingUnit;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  merchantPremiumBillingInterval?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  merchantPremiumGraceDays?: number;

  @IsOptional()
  @IsBoolean()
  merchantPremiumTrialEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  merchantPremiumTrialUnits?: number;

  @IsOptional()
  @IsBoolean()
  merchantPremiumPromoEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  merchantPremiumPromoPercentOff?: number;

  @IsOptional()
  @IsDateString()
  merchantPremiumPromoEndsAt?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  producerPremiumPriceXof?: number;

  @IsOptional()
  @IsEnum(MerchantPremiumBillingUnit)
  producerPremiumBillingUnit?: MerchantPremiumBillingUnit;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  producerPremiumBillingInterval?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  producerPremiumGraceDays?: number;

  @IsOptional()
  @IsBoolean()
  producerPremiumTrialEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  producerPremiumTrialUnits?: number;

  @IsOptional()
  @IsBoolean()
  producerPremiumPromoEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  producerPremiumPromoPercentOff?: number;

  @IsOptional()
  @IsDateString()
  producerPremiumPromoEndsAt?: string | null;
}

export class AdminAiAskDto {
  @IsString()
  @MaxLength(2000)
  question!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;
}

export class AdminAiLocaleDto {
  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;
}

export class CreateSanitaryAlertDto {
  @IsString()
  @MaxLength(200)
  zoneName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  regionCode?: string;

  @IsEnum(SanitaryAlertType)
  alertType!: SanitaryAlertType;

  @IsEnum(SanitaryAlertLevel)
  level!: SanitaryAlertLevel;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  diseaseName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  caseCount?: number;

  @IsString()
  @MaxLength(4000)
  message!: string;
}

export class CreateSuperAdminDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}

export class InstitutionMenuPermissionDto {
  @IsString()
  @MaxLength(40)
  menu!: string;

  @IsString()
  @MaxLength(8)
  access!: "read" | "write";
}

export class CreateInstitutionConsoleUserDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  institutionLabel?: string;

  /** URL de redirection après invitation (console admin). */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  inviteRedirectTo?: string;

  @IsOptional()
  menuPermissions?: Record<string, "read" | "write">;

  @IsOptional()
  statSectionPermissions?: Record<string, boolean>;
}

export class UpdateInstitutionConsoleUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  institutionLabel?: string;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  menuPermissions?: Record<string, "read" | "write">;

  @IsOptional()
  statSectionPermissions?: Record<string, boolean>;
}

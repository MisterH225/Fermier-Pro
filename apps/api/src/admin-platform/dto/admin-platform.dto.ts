import { IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { SanitaryAlertLevel, SanitaryAlertType } from "@prisma/client";

export class RejectVetProfileAdminDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;
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

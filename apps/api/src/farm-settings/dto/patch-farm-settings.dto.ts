import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";

export class PatchFarmAppSettingsDto {
  @IsOptional()
  @IsIn(["fr", "en"])
  language?: "fr" | "en";

  @IsOptional()
  @IsString()
  dateFormat?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsIn(["light", "dark", "system"])
  theme?: "light" | "dark" | "system";

  @IsOptional()
  @IsBoolean()
  budgetAutoSuggest?: boolean;

  @IsOptional()
  @IsString()
  dailySummaryHour?: string | null;

  @IsOptional()
  @IsObject()
  notificationExtra?: Record<string, unknown>;
}

export class PatchFarmFinanceSettingsDto {
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  currencySymbol?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lowBalanceThreshold?: number | null;
}

export class PatchFarmAlertSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mortalityRateThresholdPct?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lowBalanceThreshold?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  stockWarningDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  stockCriticalDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  starterMaxAvgWeightKg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  starterMaxAvgAgeWeeks?: number | null;

  @IsOptional()
  @IsBoolean()
  pushStock?: boolean;

  @IsOptional()
  @IsBoolean()
  pushHealth?: boolean;

  @IsOptional()
  @IsBoolean()
  pushFinance?: boolean;

  @IsOptional()
  @IsBoolean()
  pushGestation?: boolean;

  @IsOptional()
  @IsBoolean()
  pushCheptel?: boolean;

  @IsOptional()
  @IsBoolean()
  pushMarket?: boolean;
}

export class PatchFarmProfitabilitySettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  marketPricePerKg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  icTargetStarter?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  icTargetGrowth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  icTargetFattening?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  gmqRefStarter?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  gmqRefGrowth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  gmqRefFattening?: number;
}

export class PatchGmqTargetDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  gmqTargetStarter?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  gmqTargetGrowth?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  gmqTargetFattening?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(500)
  targetSaleWeightKg?: number | null;
}

export class PatchFarmGestationSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(21)
  @Max(35)
  weaningDurationDays?: number;
}

export class PatchFarmCheptelDto {
  @IsOptional()
  @IsIn(["individual", "batch", "hybrid"])
  livestockMode?: "individual" | "batch" | "hybrid";

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number | null;
}

export class PatchFarmSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PatchFarmAppSettingsDto)
  app?: PatchFarmAppSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PatchFarmFinanceSettingsDto)
  finance?: PatchFarmFinanceSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PatchFarmAlertSettingsDto)
  alerts?: PatchFarmAlertSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PatchFarmProfitabilitySettingsDto)
  profitability?: PatchFarmProfitabilitySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PatchGmqTargetDto)
  gmqTargets?: PatchGmqTargetDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PatchFarmGestationSettingsDto)
  gestation?: PatchFarmGestationSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PatchFarmCheptelDto)
  farm?: PatchFarmCheptelDto;
}

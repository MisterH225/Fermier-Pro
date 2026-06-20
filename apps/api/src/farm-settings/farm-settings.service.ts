import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import { FinanceService } from "../finance/finance.service";
import { GestationService } from "../gestation/gestation.service";
import { PrismaService } from "../prisma/prisma.service";
import { SmartAlertsService } from "../smart-alerts/smart-alerts.service";
import type { PatchFarmSettingsDto } from "./dto/patch-farm-settings.dto";

const GMQ_PHASE_KEYS = {
  starter: "starter",
  growth: "growth",
  fattening: "finishing"
} as const;

function dec(v: Prisma.Decimal | null | undefined): number | null {
  if (v == null) {
    return null;
  }
  return Number(v);
}

@Injectable()
export class FarmSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly finance: FinanceService,
    private readonly smartAlerts: SmartAlertsService,
    private readonly gestation: GestationService
  ) {}

  private async ensureAppSettings(farmId: string) {
    return this.prisma.farmAppSettings.upsert({
      where: { farmId },
      create: { farmId },
      update: {}
    });
  }

  private async ensureProfitabilitySettings(farmId: string) {
    return this.prisma.farmProfitabilitySettings.upsert({
      where: { farmId },
      create: { farmId },
      update: {}
    });
  }

  private gmqByKey(
    rows: { categoryKey: string; targetGmqGPerDay: Prisma.Decimal | null; targetSaleWeightKg: Prisma.Decimal | null }[],
    key: string
  ) {
    return rows.find((r) => r.categoryKey === key) ?? null;
  }

  async getAll(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await ensureFarmFinanceBootstrap(this.prisma, farmId);

    const [
      farm,
      finance,
      alerts,
      gestationSettings,
      gmqRows,
      profitability,
      app
    ] = await Promise.all([
      this.prisma.farm.findUniqueOrThrow({ where: { id: farmId } }),
      this.prisma.farmFinanceSettings.findUniqueOrThrow({ where: { farmId } }),
      this.smartAlerts.getOrCreateSettings(user, farmId),
      this.gestation.getSettings(user, farmId),
      this.prisma.farmGmqSettings.findMany({
        where: { farmId },
        orderBy: { categoryKey: "asc" }
      }),
      this.ensureProfitabilitySettings(farmId),
      this.ensureAppSettings(farmId)
    ]);

    const starterGmq = this.gmqByKey(gmqRows, GMQ_PHASE_KEYS.starter);
    const growthGmq = this.gmqByKey(gmqRows, GMQ_PHASE_KEYS.growth);
    const fatteningGmq = this.gmqByKey(gmqRows, GMQ_PHASE_KEYS.fattening);

    return {
      farm: {
        id: farm.id,
        name: farm.name,
        speciesFocus: farm.speciesFocus,
        livestockMode: farm.livestockMode,
        address: farm.address,
        locationSector: farm.locationSector,
        locationCity: farm.locationCity,
        locationCountry: farm.locationCountry,
        latitude: dec(farm.latitude),
        longitude: dec(farm.longitude),
        housingBuildingsCount: farm.housingBuildingsCount,
        housingPensPerBuilding: farm.housingPensPerBuilding,
        housingMaxPigsPerPen: farm.housingMaxPigsPerPen
      },
      app: {
        language: app.language,
        dateFormat: app.dateFormat,
        timezone: app.timezone,
        theme: app.theme,
        budgetAutoSuggest: app.budgetAutoSuggest,
        dailySummaryHour: app.dailySummaryHour,
        notificationExtra: app.notificationExtra
      },
      finance: {
        currencyCode: finance.currencyCode,
        currencySymbol: finance.currencySymbol,
        lowBalanceThreshold: dec(finance.lowBalanceThreshold)
      },
      alerts: {
        mortalityRateThresholdPct: dec(alerts.mortalityRateThresholdPct),
        lowBalanceThreshold: dec(alerts.lowBalanceThreshold),
        stockWarningDays: alerts.stockWarningDays,
        stockCriticalDays: alerts.stockCriticalDays,
        starterMaxAvgWeightKg: dec(alerts.starterMaxAvgWeightKg),
        starterMaxAvgAgeWeeks: alerts.starterMaxAvgAgeWeeks,
        pushStock: alerts.pushStock,
        pushHealth: alerts.pushHealth,
        pushFinance: alerts.pushFinance,
        pushGestation: alerts.pushGestation,
        pushCheptel: alerts.pushCheptel,
        pushMarket: alerts.pushMarket
      },
      gestation: {
        gestationDurationDays: gestationSettings.gestationDurationDays,
        weaningDurationDays: gestationSettings.weaningDurationDays,
        vaccineSchedule: gestationSettings.vaccineSchedule
      },
      profitability: {
        marketPricePerKg: dec(profitability.marketPricePerKg),
        icTargetStarter: dec(profitability.icTargetStarter),
        icTargetGrowth: dec(profitability.icTargetGrowth),
        icTargetFattening: dec(profitability.icTargetFattening),
        gmqRefStarter: profitability.gmqRefStarter,
        gmqRefGrowth: profitability.gmqRefGrowth,
        gmqRefFattening: profitability.gmqRefFattening
      },
      gmqTargets: {
        gmqTargetStarter: dec(starterGmq?.targetGmqGPerDay ?? null),
        gmqTargetGrowth: dec(growthGmq?.targetGmqGPerDay ?? null),
        gmqTargetFattening: dec(fatteningGmq?.targetGmqGPerDay ?? null),
        targetSaleWeightKg: dec(
          fatteningGmq?.targetSaleWeightKg ??
            starterGmq?.targetSaleWeightKg ??
            null
        )
      }
    };
  }

  async patch(user: User, farmId: string, dto: PatchFarmSettingsDto) {
    if (dto.finance) {
      await this.finance.updateFinanceSettings(user, farmId, dto.finance);
    }
    if (dto.alerts) {
      await this.smartAlerts.updateSettings(user, farmId, dto.alerts);
    }
    if (dto.profitability) {
      await this.patchProfitability(user, farmId, dto.profitability);
    }
    if (dto.gmqTargets) {
      await this.patchGmqTargets(farmId, dto.gmqTargets);
    }
    if (dto.gestation?.weaningDurationDays != null) {
      await this.gestation.updateSettings(user, farmId, {
        weaningDurationDays: dto.gestation.weaningDurationDays
      });
    }
    if (dto.app) {
      await this.patchApp(farmId, dto.app);
    }
    if (dto.farm) {
      await this.patchFarm(user, farmId, dto.farm);
    }
    return this.getAll(user, farmId);
  }

  async patchCurrency(
    user: User,
    farmId: string,
    currencyCode: string,
    currencySymbol: string
  ) {
    return this.patch(user, farmId, {
      finance: { currencyCode, currencySymbol }
    });
  }

  async patchLanguage(user: User, farmId: string, language: "fr" | "en") {
    return this.patch(user, farmId, { app: { language } });
  }

  async patchNotifications(
    user: User,
    farmId: string,
    patch: {
      push?: Partial<PatchFarmSettingsDto["alerts"]>;
      extra?: Record<string, unknown>;
    }
  ) {
    if (patch.push && Object.keys(patch.push).length > 0) {
      await this.smartAlerts.updateSettings(user, farmId, patch.push);
    }
    if (patch.extra) {
      const app = await this.ensureAppSettings(farmId);
      const prev =
        app.notificationExtra &&
        typeof app.notificationExtra === "object" &&
        !Array.isArray(app.notificationExtra)
          ? (app.notificationExtra as Record<string, unknown>)
          : {};
      await this.prisma.farmAppSettings.update({
        where: { farmId },
        data: {
          notificationExtra: { ...prev, ...patch.extra } as Prisma.InputJsonValue
        }
      });
    }
    return this.getAll(user, farmId);
  }

  private async patchApp(
    farmId: string,
    dto: NonNullable<PatchFarmSettingsDto["app"]>
  ) {
    await this.ensureAppSettings(farmId);
    await this.prisma.farmAppSettings.update({
      where: { farmId },
      data: {
        ...(dto.language != null ? { language: dto.language } : {}),
        ...(dto.dateFormat != null ? { dateFormat: dto.dateFormat } : {}),
        ...(dto.timezone != null ? { timezone: dto.timezone } : {}),
        ...(dto.theme != null ? { theme: dto.theme } : {}),
        ...(dto.budgetAutoSuggest != null
          ? { budgetAutoSuggest: dto.budgetAutoSuggest }
          : {}),
        ...(dto.dailySummaryHour !== undefined
          ? { dailySummaryHour: dto.dailySummaryHour }
          : {}),
        ...(dto.notificationExtra != null
          ? { notificationExtra: dto.notificationExtra as Prisma.InputJsonValue }
          : {})
      }
    });
  }

  private async patchProfitability(
    user: User,
    farmId: string,
    dto: NonNullable<PatchFarmSettingsDto["profitability"]>
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await this.ensureProfitabilitySettings(farmId);
    await this.prisma.farmProfitabilitySettings.update({
      where: { farmId },
      data: {
        ...(dto.marketPricePerKg !== undefined
          ? {
              marketPricePerKg:
                dto.marketPricePerKg == null
                  ? null
                  : new Prisma.Decimal(dto.marketPricePerKg)
            }
          : {}),
        ...(dto.icTargetStarter != null
          ? { icTargetStarter: new Prisma.Decimal(dto.icTargetStarter) }
          : {}),
        ...(dto.icTargetGrowth != null
          ? { icTargetGrowth: new Prisma.Decimal(dto.icTargetGrowth) }
          : {}),
        ...(dto.icTargetFattening != null
          ? { icTargetFattening: new Prisma.Decimal(dto.icTargetFattening) }
          : {}),
        ...(dto.gmqRefStarter != null ? { gmqRefStarter: dto.gmqRefStarter } : {}),
        ...(dto.gmqRefGrowth != null ? { gmqRefGrowth: dto.gmqRefGrowth } : {}),
        ...(dto.gmqRefFattening != null
          ? { gmqRefFattening: dto.gmqRefFattening }
          : {})
      }
    });
  }

  private async patchGmqTargets(
    farmId: string,
    dto: NonNullable<PatchFarmSettingsDto["gmqTargets"]>
  ) {
    const upsert = async (
      categoryKey: string,
      targetGmqGPerDay: number | null | undefined,
      targetSaleWeightKg?: number | null
    ) => {
      if (targetGmqGPerDay === undefined && targetSaleWeightKg === undefined) {
        return;
      }
      await this.prisma.farmGmqSettings.upsert({
        where: { farmId_categoryKey: { farmId, categoryKey } },
        create: {
          farmId,
          categoryKey,
          targetGmqGPerDay:
            targetGmqGPerDay != null
              ? new Prisma.Decimal(targetGmqGPerDay)
              : null,
          targetSaleWeightKg:
            targetSaleWeightKg != null
              ? new Prisma.Decimal(targetSaleWeightKg)
              : null
        },
        update: {
          ...(targetGmqGPerDay !== undefined
            ? {
                targetGmqGPerDay:
                  targetGmqGPerDay == null
                    ? null
                    : new Prisma.Decimal(targetGmqGPerDay)
              }
            : {}),
          ...(targetSaleWeightKg !== undefined
            ? {
                targetSaleWeightKg:
                  targetSaleWeightKg == null
                    ? null
                    : new Prisma.Decimal(targetSaleWeightKg)
              }
            : {})
        }
      });
    };

    if (dto.gmqTargetStarter !== undefined) {
      await upsert(GMQ_PHASE_KEYS.starter, dto.gmqTargetStarter);
    }
    if (dto.gmqTargetGrowth !== undefined) {
      await upsert(GMQ_PHASE_KEYS.growth, dto.gmqTargetGrowth);
    }
    if (dto.gmqTargetFattening !== undefined) {
      await upsert(
        GMQ_PHASE_KEYS.fattening,
        dto.gmqTargetFattening,
        dto.targetSaleWeightKg
      );
    } else if (dto.targetSaleWeightKg !== undefined) {
      await upsert(GMQ_PHASE_KEYS.fattening, undefined, dto.targetSaleWeightKg);
    }
  }

  private async patchFarm(
    user: User,
    farmId: string,
    dto: NonNullable<PatchFarmSettingsDto["farm"]>
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await this.prisma.farm.update({
      where: { id: farmId },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.livestockMode != null ? { livestockMode: dto.livestockMode } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.latitude !== undefined
          ? {
              latitude:
                dto.latitude == null ? null : new Prisma.Decimal(dto.latitude)
            }
          : {}),
        ...(dto.longitude !== undefined
          ? {
              longitude:
                dto.longitude == null ? null : new Prisma.Decimal(dto.longitude)
            }
          : {})
      }
    });
  }
}

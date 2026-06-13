import { Injectable, Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  calculateBatchProfitability,
  persistBatchSnapshot
} from "./batch-profitability.calculator";
import {
  calculateFarmProfitability,
  persistFarmSnapshot
} from "./farm-profitability.calculator";
import type {
  BatchProfitabilityResult,
  FarmProfitabilityDashboardDto,
  FarmProfitabilityResult,
  ProfitabilityPeriodKey
} from "./profitability.types";
import { dec } from "./profitability-period.util";

@Injectable()
export class ProfitabilityEngine {
  private readonly log = new Logger(ProfitabilityEngine.name);
  private readonly recalculating = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async calculateFarmProfitability(
    farmId: string,
    period: ProfitabilityPeriodKey = "current_month",
    custom?: { start: string; end: string }
  ): Promise<FarmProfitabilityResult> {
    const result = await calculateFarmProfitability(
      this.prisma,
      farmId,
      period,
      custom
    );
    await persistFarmSnapshot(this.prisma, result).catch((e) =>
      this.log.warn(`Snapshot ferme ${farmId}: ${(e as Error).message}`)
    );
    return result;
  }

  async calculateBatchProfitability(
    farmId: string,
    batchId: string
  ): Promise<BatchProfitabilityResult> {
    const settings = await this.prisma.farmProfitabilitySettings.findUnique({
      where: { farmId }
    });
    const marketPrice = settings?.marketPricePerKg
      ? dec(settings.marketPricePerKg)
      : null;
    const result = await calculateBatchProfitability(
      this.prisma,
      farmId,
      batchId,
      marketPrice
    );
    await persistBatchSnapshot(this.prisma, farmId, result).catch((e) =>
      this.log.warn(`Snapshot bande ${batchId}: ${(e as Error).message}`)
    );
    return result;
  }

  async calculateAllBatches(
    farmId: string
  ): Promise<BatchProfitabilityResult[]> {
    const batches = await this.prisma.livestockBatch.findMany({
      where: { farmId },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });
    const results: BatchProfitabilityResult[] = [];
    for (const b of batches) {
      results.push(await this.calculateBatchProfitability(farmId, b.id));
    }
    return results;
  }

  async getDashboardData(
    farmId: string,
    period: ProfitabilityPeriodKey = "current_month"
  ): Promise<FarmProfitabilityDashboardDto> {
    const [farm, batches] = await Promise.all([
      this.calculateFarmProfitability(farmId, period),
      this.calculateAllBatches(farmId)
    ]);

    const openBatches = batches.filter((b) => b.status === "open");
    const ranked = [...batches].sort(
      (a, b) =>
        (b.realized.netMarginPct ?? -Infinity) -
        (a.realized.netMarginPct ?? -Infinity)
    );

    const netMargin = farm.realized.netMargin;
    return {
      period,
      currency: farm.currency,
      marketPricePerKg: farm.marketPricePerKg,
      dataQuality: farm.dataQuality,
      dataQualityMessage: farm.dataQualityMessage,
      netMargin,
      netMarginPct: farm.realized.netMarginPct,
      grossMargin: farm.realized.grossMargin,
      grossMarginPct: farm.realized.grossMarginPct,
      costPerKg: farm.realized.costPerKg,
      breakevenPricePerKg: farm.realized.breakevenPricePerKg,
      trendNetMarginPctDelta: farm.trendVsPreviousPeriod.netMarginPctDelta,
      isProfitable: netMargin != null ? netMargin > 0 : null,
      activeBatchesCount: openBatches.length,
      bestBatch: ranked[0]
        ? {
            id: ranked[0].batchId,
            name: ranked[0].batchName,
            netMarginPct: ranked[0].realized.netMarginPct
          }
        : null,
      worstBatch: ranked.length > 1
        ? {
            id: ranked[ranked.length - 1]!.batchId,
            name: ranked[ranked.length - 1]!.batchName,
            netMarginPct: ranked[ranked.length - 1]!.realized.netMarginPct
          }
        : null,
      realized: farm.realized,
      projected: farm.projected
    };
  }

  /** Recalcul async — ne bloque pas l'appelant. */
  scheduleRecalculate(farmId: string): void {
    if (this.recalculating.has(farmId)) {
      return;
    }
    this.recalculating.add(farmId);
    void this.recalculateInternal(farmId)
      .catch((e) =>
        this.log.warn(
          `Recalcul rentabilité ${farmId}: ${(e as Error).message}`
        )
      )
      .finally(() => {
        this.recalculating.delete(farmId);
      });
  }

  private async recalculateInternal(farmId: string): Promise<void> {
    const periods: ProfitabilityPeriodKey[] = [
      "current_month",
      "current_quarter",
      "current_year"
    ];
    for (const period of periods) {
      await this.calculateFarmProfitability(farmId, period);
    }
    await this.calculateAllBatches(farmId);
  }
}

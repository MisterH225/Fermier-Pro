import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { gmqBetween } from "../cheptel/cheptel-gmq.util";
import { PrismaService } from "../prisma/prisma.service";
import type { InsightResponse } from "./insights.types";

function decimalToNum(v: { toNumber(): number } | number | null | undefined): number {
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  return v.toNumber();
}

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
  ) {}

  async afterWeighing(
    user: User,
    farmId: string,
    query: { animalId?: string; batchId?: string }
  ): Promise<InsightResponse | null> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    if (!query.animalId && !query.batchId) {
      throw new BadRequestException("animalId ou batchId requis");
    }
    if (query.animalId && query.batchId) {
      throw new BadRequestException("Fournir animalId ou batchId, pas les deux");
    }

    if (query.animalId) {
      const animal = await this.prisma.animal.findFirst({
        where: { id: query.animalId, farmId },
        select: { id: true }
      });
      if (!animal) {
        throw new NotFoundException("Animal introuvable");
      }
      const weights = await this.prisma.animalWeight.findMany({
        where: { animalId: query.animalId },
        orderBy: { measuredAt: "asc" },
        select: { weightKg: true, measuredAt: true }
      });
      return this.gmqInsightFromPoints(
        weights.map((w) => ({
          kg: decimalToNum(w.weightKg),
          at: w.measuredAt
        }))
      );
    }

    const batch = await this.prisma.livestockBatch.findFirst({
      where: { id: query.batchId!, farmId },
      select: { id: true }
    });
    if (!batch) {
      throw new NotFoundException("Bande introuvable");
    }
    const weights = await this.prisma.livestockBatchWeight.findMany({
      where: { batchId: query.batchId! },
      orderBy: { measuredAt: "asc" },
      select: { avgWeightKg: true, measuredAt: true }
    });
    return this.gmqInsightFromPoints(
      weights.map((w) => ({
        kg: decimalToNum(w.avgWeightKg),
        at: w.measuredAt
      }))
    );
  }

  /**
   * Compare le dernier intervalle GMQ au précédent (réutilise gmqBetween).
   * Moins de 2 intervalles → félicitation first.
   */
  gmqInsightFromPoints(
    points: { kg: number; at: Date }[]
  ): InsightResponse | null {
    const sorted = [...points]
      .filter((p) => Number.isFinite(p.kg) && p.kg > 0)
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    if (sorted.length < 2) {
      return {
        kind: "first",
        headline: { key: "insights.firstWeighing" }
      };
    }

    const gmqs: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const g = gmqBetween(
        sorted[i - 1].kg,
        sorted[i].kg,
        sorted[i - 1].at,
        sorted[i].at
      );
      if (g != null && Number.isFinite(g)) {
        gmqs.push(g);
      }
    }
    if (gmqs.length === 0) {
      return {
        kind: "first",
        headline: { key: "insights.firstWeighing" }
      };
    }
    if (gmqs.length === 1) {
      const gmq = Math.round(gmqs[0]);
      return {
        kind: "first",
        headline: {
          key: "insights.firstGmq",
          params: { gmq }
        }
      };
    }

    const current = gmqs[gmqs.length - 1];
    const previous = gmqs[gmqs.length - 2];
    const deltaPct =
      previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;
    const sign = deltaPct >= 0 ? "+" : "";
    const key =
      deltaPct > 0.5
        ? "insights.gmqUp"
        : deltaPct < -0.5
          ? "insights.gmqDown"
          : "insights.gmqFlat";
    return {
      kind: "delta",
      headline: {
        key,
        params: {
          gmq: Math.round(current),
          delta: `${sign}${Math.round(deltaPct)}`,
          period: "intervalle"
        }
      }
    };
  }

  async afterSale(
    user: User,
    farmId: string,
    exitId: string
  ): Promise<InsightResponse | null> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const exit = await this.prisma.livestockExit.findFirst({
      where: { id: exitId, farmId },
      select: { price: true, weightKg: true, currency: true }
    });
    if (!exit) {
      throw new NotFoundException("Sortie introuvable");
    }
    const price = decimalToNum(exit.price);
    const weight = decimalToNum(exit.weightKg);
    if (!(price > 0) || !(weight > 0)) {
      return null; // 204 — pas d'estimation inventée
    }
    const pricePerKg = price / weight;

    const indexRow = await this.prisma.pigPriceIndexDaily.findFirst({
      orderBy: { date: "desc" },
      select: { avgPricePerKg: true, date: true }
    });
    if (!indexRow) {
      return {
        kind: "info",
        headline: {
          key: "insights.salePriceOnly",
          params: {
            pricePerKg: Math.round(pricePerKg),
            currency: exit.currency || "XOF"
          }
        }
      };
    }

    const index = decimalToNum(indexRow.avgPricePerKg);
    if (!(index > 0)) {
      return null;
    }
    const deltaPct = ((pricePerKg - index) / index) * 100;
    const sign = deltaPct >= 0 ? "+" : "";
    return {
      kind: "compare",
      headline: {
        key: "insights.saleVsIndex",
        params: {
          pricePerKg: Math.round(pricePerKg),
          index: Math.round(index),
          delta: `${sign}${Math.round(deltaPct)}`,
          currency: exit.currency || "XOF"
        }
      }
    };
  }

  async afterFarrowing(
    user: User,
    farmId: string,
    litterId: string
  ): Promise<InsightResponse | null> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const litter = await this.prisma.litter.findFirst({
      where: { id: litterId, farmId },
      select: { id: true, bornAlive: true, recordedAt: true }
    });
    if (!litter) {
      throw new NotFoundException("Portée introuvable");
    }

    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - 12);

    const others = await this.prisma.litter.findMany({
      where: {
        farmId,
        id: { not: litter.id },
        recordedAt: { gte: since }
      },
      select: { bornAlive: true }
    });

    if (others.length === 0) {
      return {
        kind: "first",
        headline: {
          key: "insights.firstLitter",
          params: { bornAlive: litter.bornAlive }
        }
      };
    }

    const avg =
      others.reduce((s, l) => s + l.bornAlive, 0) / others.length;
    const delta = litter.bornAlive - avg;
    const sign = delta >= 0 ? "+" : "";
    return {
      kind: "compare",
      headline: {
        key: "insights.litterVsFarmAvg",
        params: {
          bornAlive: litter.bornAlive,
          avg: Math.round(avg * 10) / 10,
          delta: `${sign}${Math.round(delta * 10) / 10}`
        }
      }
    };
  }
}

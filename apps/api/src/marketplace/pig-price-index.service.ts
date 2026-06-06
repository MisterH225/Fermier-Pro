import { Injectable, Logger } from "@nestjs/common";
import { ListingStatus, OfferStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import {
  accountAgeDays,
  computeTrend,
  HYBRID_INDEX_RULES,
  isListingEligibleForIndex,
  priceDeviationPct,
  resolveSellerIndexWeight,
  variationPct,
  weightedMedian,
  winsorizePoints,
  type HybridIndexPoint,
  type HybridIndexTrend
} from "./pig-price-index.utils";

export type HybridIndexPublicDto = {
  price_per_kg: number;
  trend: HybridIndexTrend;
  variation_7d_pct: number | null;
  calculated_at: string;
  data_points_count: number;
};

export type HybridIndexCalculationResult = {
  indexValue: number | null;
  confirmedCount: number;
  listingCount: number;
  totalWeightKg: number;
  dataPointsCount: number;
  isFrozen: boolean;
  freezeReason: string | null;
  flaggedListingIds: string[];
};

@Injectable()
export class MarketplacePigPriceIndexService {
  private readonly log = new Logger(MarketplacePigPriceIndexService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationsService
  ) {}

  /** Recalcule l'indice hybride, applique le circuit breaker, persiste le snapshot. */
  async calculateHybridIndex(): Promise<HybridIndexCalculationResult> {
    const now = new Date();
    const since = new Date(
      now.getTime() - HYBRID_INDEX_RULES.lookbackDays * 86_400_000
    );

    const lastValid = await this.getLastValidSnapshot();
    const referenceIndex = lastValid ? Number(lastValid.indexValue) : null;

    const confirmedPoints = await this.loadConfirmedTransactions(since);
    const { listingPoints, flagged } = await this.loadEligibleListings(
      referenceIndex
    );

    const allPoints = [...confirmedPoints, ...listingPoints];
    const winsorized = winsorizePoints(allPoints);
    const indexValue = weightedMedian(winsorized);

    const confirmedCount = confirmedPoints.length;
    const listingCount = listingPoints.length;
    const totalWeightKg = allPoints.reduce((s, p) => s + p.volumeKg, 0);
    const dataPointsCount = allPoints.length;

    if (indexValue == null) {
      return {
        indexValue: null,
        confirmedCount,
        listingCount,
        totalWeightKg,
        dataPointsCount,
        isFrozen: false,
        freezeReason: null,
        flaggedListingIds: flagged.map((f) => f.listingId)
      };
    }

    let isFrozen = false;
    let freezeReason: string | null = null;

    if (referenceIndex != null && referenceIndex > 0) {
      const dailyDev = priceDeviationPct(indexValue, referenceIndex);
      if (
        dailyDev != null &&
        dailyDev > HYBRID_INDEX_RULES.circuitBreakerDailyPct
      ) {
        isFrozen = true;
        freezeReason = `Variation journalière ${dailyDev.toFixed(1)} % > ${HYBRID_INDEX_RULES.circuitBreakerDailyPct} %`;
        await this.alertSuperAdmins(freezeReason, indexValue, referenceIndex);
      }
    }

    if (flagged.length > 0) {
      await this.prisma.pigPriceIndexFlaggedListing.createMany({
        data: flagged.map((f) => ({
          listingId: f.listingId,
          sellerUserId: f.sellerUserId,
          pricePerKg: new Prisma.Decimal(f.pricePerKg),
          deviationPct: new Prisma.Decimal(f.deviationPct)
        }))
      });
    }

    if (!isFrozen) {
      await this.prisma.pigPriceIndexHybridSnapshot.create({
        data: {
          indexValue: new Prisma.Decimal(indexValue),
          confirmedCount,
          listingCount,
          totalWeightKg: new Prisma.Decimal(totalWeightKg),
          isFrozen: false,
          freezeReason: null
        }
      });
    } else {
      await this.prisma.pigPriceIndexHybridSnapshot.create({
        data: {
          indexValue: new Prisma.Decimal(referenceIndex!),
          confirmedCount,
          listingCount,
          totalWeightKg: new Prisma.Decimal(totalWeightKg),
          isFrozen: true,
          freezeReason
        }
      });
    }

    this.log.log(
      `Hybrid index: ${indexValue.toFixed(2)} FCFA/kg (${confirmedCount} tx, ${listingCount} listings) frozen=${isFrozen}`
    );

    return {
      indexValue: isFrozen ? referenceIndex : indexValue,
      confirmedCount,
      listingCount,
      totalWeightKg,
      dataPointsCount,
      isFrozen,
      freezeReason,
      flaggedListingIds: flagged.map((f) => f.listingId)
    };
  }

  /** Dernier snapshot valide affiché aux utilisateurs (ignore les gelés pour la valeur). */
  async getPublicIndex(): Promise<HybridIndexPublicDto | null> {
    const snapshot = await this.getLastValidSnapshot();
    if (!snapshot) {
      return null;
    }

    const price = Number(snapshot.indexValue);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const weekSnapshot =
      await this.prisma.pigPriceIndexHybridSnapshot.findFirst({
        where: {
          calculatedAt: { lte: weekAgo },
          isFrozen: false
        },
        orderBy: { calculatedAt: "desc" }
      });

    const weekPrice = weekSnapshot ? Number(weekSnapshot.indexValue) : null;
    const var7d = variationPct(price, weekPrice);
    const trend = computeTrend(price, weekPrice);

    return {
      price_per_kg: price,
      trend,
      variation_7d_pct: var7d,
      calculated_at: snapshot.calculatedAt.toISOString(),
      data_points_count: snapshot.confirmedCount + snapshot.listingCount
    };
  }

  async getLastValidSnapshot() {
    return this.prisma.pigPriceIndexHybridSnapshot.findFirst({
      where: { isFrozen: false },
      orderBy: { calculatedAt: "desc" }
    });
  }

  async getSnapshots(limit = 30) {
    return this.prisma.pigPriceIndexHybridSnapshot.findMany({
      orderBy: { calculatedAt: "desc" },
      take: limit
    });
  }

  async getFlaggedListings(limit = 50) {
    return this.prisma.pigPriceIndexFlaggedListing.findMany({
      orderBy: { flaggedAt: "desc" },
      take: limit
    });
  }

  async unfreezeIndex(): Promise<{ ok: true; recalculated: boolean }> {
    const latest = await this.prisma.pigPriceIndexHybridSnapshot.findFirst({
      orderBy: { calculatedAt: "desc" }
    });
    if (!latest?.isFrozen) {
      return { ok: true, recalculated: false };
    }
    await this.calculateHybridIndex();
    return { ok: true, recalculated: true };
  }

  async getTopContributors(limit = 10) {
    const since = new Date(
      Date.now() - HYBRID_INDEX_RULES.lookbackDays * 86_400_000
    );
    const sold = await this.prisma.marketplaceListing.findMany({
      where: {
        status: ListingStatus.sold,
        updatedAt: { gte: since },
        totalWeightKg: { gt: 0 },
        totalPrice: { gt: 0 }
      },
      select: {
        sellerUserId: true,
        totalWeightKg: true,
        seller: { select: { fullName: true, email: true } }
      }
    });

    const bySeller = new Map<
      string,
      { volumeKg: number; count: number; name: string }
    >();
    for (const row of sold) {
      const kg = Number(row.totalWeightKg);
      if (!Number.isFinite(kg) || kg <= 0) {
        continue;
      }
      const cur = bySeller.get(row.sellerUserId) ?? {
        volumeKg: 0,
        count: 0,
        name:
          row.seller.fullName?.trim() ||
          row.seller.email?.trim() ||
          row.sellerUserId.slice(0, 8)
      };
      cur.volumeKg += kg;
      cur.count += 1;
      bySeller.set(row.sellerUserId, cur);
    }

    return [...bySeller.entries()]
      .map(([sellerUserId, v]) => ({
        sellerUserId,
        sellerName: v.name,
        volumeKg: v.volumeKg,
        transactionCount: v.count
      }))
      .sort((a, b) => b.volumeKg - a.volumeKg)
      .slice(0, limit);
  }

  /** Met à jour le poids indice vendeur après une vente conclue. */
  async refreshSellerIndexWeight(sellerUserId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: sellerUserId },
      select: {
        createdAt: true,
        completedTransactions: true,
        indexWeight: true
      }
    });
    if (!user) {
      return;
    }
    const next = resolveSellerIndexWeight(
      user.createdAt,
      user.completedTransactions,
      Number(user.indexWeight)
    );
    if (Math.abs(next - Number(user.indexWeight)) > 0.001) {
      await this.prisma.user.update({
        where: { id: sellerUserId },
        data: { indexWeight: new Prisma.Decimal(next) }
      });
    }
  }

  private async loadConfirmedTransactions(
    since: Date
  ): Promise<HybridIndexPoint[]> {
    const closed = await this.prisma.marketplaceTransaction.findMany({
      where: {
        status: "TRANSACTION_CLOSED",
        updatedAt: { gte: since },
        finalAmount: { gt: 0 }
      },
      select: {
        finalAmount: true,
        realWeightKg: true,
        arbitrationWeightKg: true,
        estimatedWeightKg: true
      }
    });

    const points: HybridIndexPoint[] = [];
    for (const tx of closed) {
      const finalAmount = Number(tx.finalAmount);
      const weight =
        tx.arbitrationWeightKg != null
          ? Number(tx.arbitrationWeightKg)
          : tx.realWeightKg != null
            ? Number(tx.realWeightKg)
            : tx.estimatedWeightKg != null
              ? Number(tx.estimatedWeightKg)
              : 0;
      if (!Number.isFinite(finalAmount) || finalAmount <= 0 || weight <= 0) {
        continue;
      }
      points.push({
        pricePerKg: finalAmount / weight,
        volumeKg: weight,
        sourceWeight: HYBRID_INDEX_RULES.confirmedWeight,
        kind: "confirmed"
      });
    }

    if (points.length > 0) {
      return points;
    }

    const listings = await this.prisma.marketplaceListing.findMany({
      where: {
        status: ListingStatus.sold,
        updatedAt: { gte: since },
        totalPrice: { gt: 0 },
        totalWeightKg: { gt: 0 },
        offers: { some: { status: OfferStatus.accepted } }
      },
      select: {
        totalPrice: true,
        totalWeightKg: true
      }
    });

    const legacyPoints: HybridIndexPoint[] = [];
    for (const l of listings) {
      const weight = Number(l.totalWeightKg);
      const price = Number(l.totalPrice);
      if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(price)) {
        continue;
      }
      legacyPoints.push({
        pricePerKg: price / weight,
        volumeKg: weight,
        sourceWeight: HYBRID_INDEX_RULES.confirmedWeight,
        kind: "confirmed"
      });
    }
    return legacyPoints;
  }

  private async loadEligibleListings(referenceIndex: number | null): Promise<{
    listingPoints: HybridIndexPoint[];
    flagged: Array<{
      listingId: string;
      sellerUserId: string;
      pricePerKg: number;
      deviationPct: number;
    }>;
  }> {
    const listings = await this.prisma.marketplaceListing.findMany({
      where: {
        status: ListingStatus.published,
        pricePerKg: { not: null },
        archived: false
      },
      select: {
        id: true,
        sellerUserId: true,
        pricePerKg: true,
        totalWeightKg: true,
        quantity: true,
        seller: {
          select: {
            createdAt: true,
            completedTransactions: true,
            indexWeight: true
          }
        }
      }
    });

    const listingPoints: HybridIndexPoint[] = [];
    const flagged: Array<{
      listingId: string;
      sellerUserId: string;
      pricePerKg: number;
      deviationPct: number;
    }> = [];

    for (const l of listings) {
      const pricePerKg = Number(l.pricePerKg);
      if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) {
        continue;
      }

      const seller = l.seller;
      if (
        !isListingEligibleForIndex(
          seller.createdAt,
          seller.completedTransactions,
          Number(seller.indexWeight)
        )
      ) {
        continue;
      }

      if (referenceIndex != null && referenceIndex > 0) {
        const dev = priceDeviationPct(pricePerKg, referenceIndex);
        if (
          dev != null &&
          dev > HYBRID_INDEX_RULES.maxPriceDeviationPct
        ) {
          flagged.push({
            listingId: l.id,
            sellerUserId: l.sellerUserId,
            pricePerKg,
            deviationPct: dev
          });
          continue;
        }
      }

      const volumeKg =
        l.totalWeightKg != null && Number(l.totalWeightKg) > 0
          ? Number(l.totalWeightKg)
          : Math.max(1, l.quantity ?? 1) * 80;

      listingPoints.push({
        pricePerKg,
        volumeKg,
        sourceWeight: HYBRID_INDEX_RULES.activeListingWeight,
        kind: "listing",
        listingId: l.id,
        sellerUserId: l.sellerUserId
      });
    }

    return { listingPoints, flagged };
  }

  private async alertSuperAdmins(
    reason: string,
    proposed: number,
    previous: number
  ): Promise<void> {
    const admins = await this.prisma.superAdmin.findMany({
      select: { userId: true }
    });
    const body = `Indice PigPrice gelé : ${reason}. Proposé ${Math.round(proposed)} vs ${Math.round(previous)} FCFA/kg.`;
    for (const { userId } of admins) {
      void this.push.sendToUser(userId, "⚠️ Indice PigPrice gelé", body, {
        type: "pig_price_index_frozen"
      });
    }
  }
}

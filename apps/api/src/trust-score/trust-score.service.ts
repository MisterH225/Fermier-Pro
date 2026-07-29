import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  Prisma,
  TrustScoreLevel,
  TrustScoreProfileType,
  type ProducerScore
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  COUNTERPARTY_VISIBLE_PILLARS,
  TRUST_SCORE_VERSION,
  isTrustScoreV2Active
} from "./trust-score.constants";
import { TrustScoreMetricsService } from "./trust-score-metrics.service";
import {
  aggregatePillars,
  endOfUtcDay,
  mapProducerScoreV1ToLevel,
  startOfUtcDay,
  type AggregatedTrustScore,
  type PillarView
} from "./trust-score.util";

export type TrustScoreVisibility = "self" | "counterpart" | "public";

export type RatingSummaryView = {
  average: number | null;
  count: number;
};

export type TrustScoreMeView = {
  score: number;
  level: TrustScoreLevel;
  pillars: PillarView[];
  isNew: boolean;
  profileType: TrustScoreProfileType;
  scoreVersion: number;
  /** Toujours false tant que TRUST_SCORE_V2_ACTIVE n'est pas activé côté runtime. */
  v2Active: boolean;
  sampleSizes: Record<string, number>;
  computedAt: string;
  ratingsSummary: RatingSummaryView;
  visibility: TrustScoreVisibility;
};

export type ShadowProfileBucket = {
  profileType: TrustScoreProfileType;
  snapshotCount: number;
  v2Distribution: Record<string, number>;
};

export type ShadowReport = {
  generatedAt: string;
  scoreVersion: number;
  v2Active: boolean;
  producerCountCompared: number;
  v1Distribution: Record<string, number>;
  v2Distribution: Record<string, number>;
  levelChangePercent: number;
  largestGaps: Array<{
    /** Hash anonymisé (préfixe userId). */
    anonId: string;
    v1Level: string;
    v2Level: string;
    v1GlobalApprox: number;
    v2Score: number;
    delta: number;
  }>;
  /** Distribution v2 par métier (mode ombre, sans servir). */
  byProfile: ShadowProfileBucket[];
  notes: string[];
};

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: TrustScoreMetricsService
  ) {}

  async getMe(
    userId: string,
    profileType: TrustScoreProfileType
  ): Promise<TrustScoreMeView> {
    return this.getScoreView(userId, profileType, "self");
  }

  /**
   * Vue contrepartie (transaction) : niveau + piliers pertinents uniquement.
   */
  async getCounterpart(
    targetUserId: string,
    profileType: TrustScoreProfileType
  ): Promise<TrustScoreMeView> {
    return this.getScoreView(targetUserId, profileType, "counterpart");
  }

  /**
   * Consultation publique : niveau + moyenne/nombre d'avis.
   * Preuves comportementales masquées.
   */
  async getPublic(
    targetUserId: string,
    profileType: TrustScoreProfileType
  ): Promise<TrustScoreMeView> {
    return this.getScoreView(targetUserId, profileType, "public");
  }

  private async getScoreView(
    userId: string,
    profileType: TrustScoreProfileType,
    visibility: TrustScoreVisibility
  ): Promise<TrustScoreMeView> {
    const latest = await this.prisma.trustScoreSnapshot.findFirst({
      where: { userId, profileType, scoreVersion: TRUST_SCORE_VERSION },
      orderBy: { computedAt: "desc" }
    });

    const stale =
      !latest ||
      Date.now() - latest.computedAt.getTime() > 12 * 3_600_000;

    const snap = stale
      ? await this.recomputeAndSnapshot(userId, profileType)
      : latest;

    let pillars = (snap.pillars as PillarView[]) ?? [];
    const sampleSizes =
      (snap.sampleSizes as Record<string, number>) ?? {};
    const isNew = snap.level === TrustScoreLevel.nouvelle;
    const ratingsSummary = await this.ratingsSummaryFor(userId, profileType);

    if (visibility === "counterpart") {
      const allowed = new Set(COUNTERPARTY_VISIBLE_PILLARS[profileType]);
      pillars = pillars.filter((p) => allowed.has(p.key));
    } else if (visibility === "public") {
      // Niveau + avis uniquement — pas de preuves comportementales
      pillars = pillars
        .filter((p) => p.key === "ratings" || p.key === "commercialTrust")
        .map((p) => ({
          ...p,
          evidence:
            p.evidence?.kind === "rating"
              ? p.evidence
              : ratingsSummary.count > 0
                ? {
                    kind: "rating" as const,
                    average: ratingsSummary.average ?? 0,
                    count: ratingsSummary.count
                  }
                : null
        }));
    }

    return {
      score: snap.score,
      level: snap.level,
      pillars,
      isNew,
      profileType,
      scoreVersion: snap.scoreVersion,
      v2Active: isTrustScoreV2Active(),
      sampleSizes,
      computedAt: snap.computedAt.toISOString(),
      ratingsSummary,
      visibility
    };
  }

  private async ratingsSummaryFor(
    userId: string,
    profileType: TrustScoreProfileType
  ): Promise<RatingSummaryView> {
    if (profileType === TrustScoreProfileType.buyer) {
      const agg = await this.prisma.buyerRating.aggregate({
        where: { buyerUserId: userId },
        _avg: { score: true },
        _count: true
      });
      return {
        average:
          agg._avg.score != null
            ? Number(Number(agg._avg.score).toFixed(2))
            : null,
        count: agg._count
      };
    }
    if (profileType === TrustScoreProfileType.merchant) {
      const agg = await this.prisma.merchantRating.aggregate({
        where: { merchantUserId: userId },
        _avg: { score: true },
        _count: true
      });
      return {
        average:
          agg._avg.score != null
            ? Number(Number(agg._avg.score).toFixed(2))
            : null,
        count: agg._count
      };
    }
    if (profileType === TrustScoreProfileType.technician) {
      const agg = await this.prisma.technicianRating.aggregate({
        where: { technicianUserId: userId },
        _avg: { score: true },
        _count: true
      });
      return {
        average:
          agg._avg.score != null
            ? Number(Number(agg._avg.score).toFixed(2))
            : null,
        count: agg._count
      };
    }
    if (profileType === TrustScoreProfileType.vet) {
      const vet = await this.prisma.vetProfile.findUnique({
        where: { userId },
        select: { ratingAvg: true, ratingCount: true }
      });
      return {
        average:
          vet?.ratingAvg != null ? Number(Number(vet.ratingAvg).toFixed(2)) : null,
        count: vet?.ratingCount ?? 0
      };
    }
    // producer — FarmMarketRating sur fermes
    const farmIds = (
      await this.prisma.farm.findMany({
        where: { ownerId: userId },
        select: { id: true }
      })
    ).map((f) => f.id);
    if (farmIds.length === 0) return { average: null, count: 0 };
    const agg = await this.prisma.farmMarketRating.aggregate({
      where: { farmId: { in: farmIds } },
      _avg: { score: true },
      _count: true
    });
    return {
      average:
        agg._avg.score != null
          ? Number(Number(agg._avg.score).toFixed(2))
          : null,
      count: agg._count
    };
  }

  async recomputeAndSnapshot(
    userId: string,
    profileType: TrustScoreProfileType,
    now = new Date()
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, createdAt: true }
    });
    if (!user) {
      throw new Error(`User ${userId} introuvable`);
    }

    const { pillars, transactionCount } = await this.collectForProfile(
      userId,
      profileType,
      now
    );
    const agg = aggregatePillars(pillars, {
      userCreatedAt: user.createdAt,
      transactionCount,
      now
    });

    return this.persistSnapshotIdempotent(userId, profileType, agg, now);
  }

  /**
   * Idempotence : un seul snapshot par (userId, profileType, scoreVersion, jour UTC).
   * Recalcul le même jour → update in-place.
   */
  async persistSnapshotIdempotent(
    userId: string,
    profileType: TrustScoreProfileType,
    agg: AggregatedTrustScore,
    now = new Date()
  ) {
    const dayStart = startOfUtcDay(now);
    const dayEnd = endOfUtcDay(now);

    const existing = await this.prisma.trustScoreSnapshot.findFirst({
      where: {
        userId,
        profileType,
        scoreVersion: TRUST_SCORE_VERSION,
        computedAt: { gte: dayStart, lte: dayEnd }
      },
      orderBy: { computedAt: "desc" }
    });

    const data = {
      pillars: agg.pillars as unknown as Prisma.InputJsonValue,
      score: agg.score,
      level: agg.level,
      sampleSizes: agg.sampleSizes as unknown as Prisma.InputJsonValue,
      computedAt: now
    };

    if (existing) {
      return this.prisma.trustScoreSnapshot.update({
        where: { id: existing.id },
        data
      });
    }

    return this.prisma.trustScoreSnapshot.create({
      data: {
        userId,
        profileType,
        scoreVersion: TRUST_SCORE_VERSION,
        ...data
      }
    });
  }

  /** Cron quotidien 04:00 — mode ombre, ne touche PAS producer-score ni crédit. */
  @Cron("0 4 * * *")
  async recomputeShadowForActiveUsers(): Promise<void> {
    this.logger.log(
      `Trust-score v2 ombre: démarrage (v2Active=${isTrustScoreV2Active()})`
    );

    const since = new Date(Date.now() - 30 * 86_400_000);
    let updated = 0;

    // Producteurs avec fermes actives
    const producers = await this.prisma.farm.findMany({
      where: { status: "active" },
      select: { ownerId: true },
      distinct: ["ownerId"]
    });
    for (const { ownerId } of producers) {
      try {
        await this.recomputeAndSnapshot(ownerId, TrustScoreProfileType.producer);
        updated += 1;
      } catch (err) {
        this.logger.warn(`trust producer ${ownerId}: ${String(err)}`);
      }
    }

    // Acheteurs actifs
    const buyers = await this.prisma.buyerProfile.findMany({
      where: { isActive: true, updatedAt: { gte: since } },
      select: { userId: true },
      take: 2000
    });
    for (const { userId } of buyers) {
      try {
        await this.recomputeAndSnapshot(userId, TrustScoreProfileType.buyer);
        updated += 1;
      } catch (err) {
        this.logger.warn(`trust buyer ${userId}: ${String(err)}`);
      }
    }

    // Marchands
    const merchants = await this.prisma.merchantProfile.findMany({
      where: { updatedAt: { gte: since } },
      select: { userId: true },
      take: 2000
    });
    for (const { userId } of merchants) {
      try {
        await this.recomputeAndSnapshot(userId, TrustScoreProfileType.merchant);
        updated += 1;
      } catch (err) {
        this.logger.warn(`trust merchant ${userId}: ${String(err)}`);
      }
    }

    // Vétérinaires (pas de flag isActive sur VetProfile)
    const vets = await this.prisma.vetProfile.findMany({
      select: { userId: true },
      take: 2000
    });
    for (const { userId } of vets) {
      try {
        await this.recomputeAndSnapshot(userId, TrustScoreProfileType.vet);
        updated += 1;
      } catch (err) {
        this.logger.warn(`trust vet ${userId}: ${String(err)}`);
      }
    }

    // Techniciens
    const techs = await this.prisma.technicianProfile.findMany({
      where: { isActive: true },
      select: { userId: true },
      take: 2000
    });
    for (const { userId } of techs) {
      try {
        await this.recomputeAndSnapshot(
          userId,
          TrustScoreProfileType.technician
        );
        updated += 1;
      } catch (err) {
        this.logger.warn(`trust tech ${userId}: ${String(err)}`);
      }
    }

    this.logger.log(`Trust-score v2 ombre: ${updated} snapshots`);
  }

  async buildShadowReport(): Promise<ShadowReport> {
    const producers = await this.prisma.producerProfile.findMany({
      where: { scoreUpdatedAt: { not: null } },
      select: {
        userId: true,
        producerScore: true,
        dataRegularityScore: true,
        platformUsageScore: true,
        responsivenessScore: true
      },
      take: 5000
    });

    const v1Distribution: Record<string, number> = {};
    const v2Distribution: Record<string, number> = {};
    const gaps: ShadowReport["largestGaps"] = [];
    let compared = 0;
    let changed = 0;

    for (const p of producers) {
      const snap = await this.prisma.trustScoreSnapshot.findFirst({
        where: {
          userId: p.userId,
          profileType: TrustScoreProfileType.producer,
          scoreVersion: TRUST_SCORE_VERSION
        },
        orderBy: { computedAt: "desc" }
      });
      if (!snap) continue;

      compared += 1;
      const v1Level = mapProducerScoreV1ToLevel(p.producerScore);
      const v1Key = p.producerScore as string;
      v1Distribution[v1Key] = (v1Distribution[v1Key] ?? 0) + 1;
      v2Distribution[snap.level] = (v2Distribution[snap.level] ?? 0) + 1;

      if (v1Level !== snap.level) changed += 1;

      const v1GlobalApprox = Math.round(
        p.dataRegularityScore * 0.35 +
          p.platformUsageScore * 0.25 +
          p.responsivenessScore * 0.4
      );
      gaps.push({
        anonId: `u_${p.userId.slice(0, 6)}…${p.userId.slice(-4)}`,
        v1Level: v1Key,
        v2Level: snap.level,
        v1GlobalApprox,
        v2Score: snap.score,
        delta: snap.score - v1GlobalApprox
      });
    }

    gaps.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const byProfile = await this.shadowDistributionByProfile();

    return {
      generatedAt: new Date().toISOString(),
      scoreVersion: TRUST_SCORE_VERSION,
      v2Active: isTrustScoreV2Active(),
      producerCountCompared: compared,
      v1Distribution,
      v2Distribution,
      levelChangePercent:
        compared === 0 ? 0 : Math.round((changed / compared) * 1000) / 10,
      largestGaps: gaps.slice(0, 25),
      byProfile,
      notes: [
        "Mode ombre : ce rapport ne modifie ni producer-score v1 ni l'éligibilité crédit.",
        "TRUST_SCORE_V2_ACTIVE reste false — ne pas basculer sans validation du rapport.",
        "User.reputationScore exclu de la v2 (pénalités d'annulation ; pas d'avis).",
        "Litiges poids (WEIGHT_ARBITRATED) exclus : pas de perdant encodé.",
        "Litiges livraison split/cancelled exclus : pas de perdant clair.",
        "E1 : piliers ratings branchés (BuyerRating, MerchantRating, TechnicianRating).",
        "E2 : preuves chiffrées dans pillars.evidence (seuil d'échantillon 5).",
        "Le score informe sans contraindre (pas de blocage crédit / achat).",
        "Commentaires d'avis privés — seul avg+count exposé publiquement."
      ]
    };
  }

  private async shadowDistributionByProfile(): Promise<ShadowProfileBucket[]> {
    const types = Object.values(TrustScoreProfileType);
    const buckets: ShadowProfileBucket[] = [];
    for (const profileType of types) {
      const snaps = await this.prisma.trustScoreSnapshot.findMany({
        where: { profileType, scoreVersion: TRUST_SCORE_VERSION },
        orderBy: { computedAt: "desc" },
        select: { userId: true, level: true },
        take: 20_000
      });
      const seen = new Set<string>();
      const v2Distribution: Record<string, number> = {};
      let snapshotCount = 0;
      for (const s of snaps) {
        if (seen.has(s.userId)) continue;
        seen.add(s.userId);
        snapshotCount += 1;
        v2Distribution[s.level] = (v2Distribution[s.level] ?? 0) + 1;
      }
      buckets.push({
        profileType,
        snapshotCount,
        v2Distribution
      });
    }
    return buckets;
  }

  private async collectForProfile(
    userId: string,
    profileType: TrustScoreProfileType,
    now: Date
  ) {
    switch (profileType) {
      case TrustScoreProfileType.producer:
        return this.metrics.collectProducerPillars(userId, now);
      case TrustScoreProfileType.buyer:
        return this.metrics.collectBuyerPillars(userId, now);
      case TrustScoreProfileType.merchant:
        return this.metrics.collectMerchantPillars(userId, now);
      case TrustScoreProfileType.vet:
        return this.metrics.collectVetPillars(userId, now);
      case TrustScoreProfileType.technician:
        return this.metrics.collectTechnicianPillars(userId, now);
      default:
        return { pillars: [], transactionCount: 0 };
    }
  }
}

/** Exposé pour tests d'idempotence sans DB. */
export function producerScoreToV1Label(score: ProducerScore): string {
  return score;
}

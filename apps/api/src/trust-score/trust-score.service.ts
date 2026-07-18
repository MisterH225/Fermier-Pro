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

    const pillars = (snap.pillars as PillarView[]) ?? [];
    const sampleSizes =
      (snap.sampleSizes as Record<string, number>) ?? {};
    const isNew = snap.level === TrustScoreLevel.nouvelle;

    return {
      score: snap.score,
      level: snap.level,
      pillars,
      isNew,
      profileType,
      scoreVersion: snap.scoreVersion,
      v2Active: isTrustScoreV2Active(),
      sampleSizes,
      computedAt: snap.computedAt.toISOString()
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
      notes: [
        "Mode ombre : ce rapport ne modifie ni producer-score v1 ni l'éligibilité crédit.",
        "User.reputationScore exclu de la v2 (pénalités d'annulation ; pas d'avis).",
        "Litiges poids (WEIGHT_ARBITRATED) exclus : pas de perdant encodé.",
        "Litiges livraison split/cancelled exclus : pas de perdant clair.",
        "Pas de modèle d'avis boutique merchant — pilier omis.",
        "Pas d'avis acheteur alimentés en base — pilier omis."
      ]
    };
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

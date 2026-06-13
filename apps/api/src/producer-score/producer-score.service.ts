import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ProducerScore } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProducerScoreMetricsService } from "./producer-score-metrics.service";
import {
  deriveProducerScore,
  globalProducerScoreValue,
  scoreFromActiveDays,
  scoreResponsiveness
} from "./producer-score.util";

export type ProducerScoreView = {
  score: ProducerScore;
  emoji: string;
  label: string;
  color: string;
  globalValue: number;
  dataRegularityScore: number;
  platformUsageScore: number;
  responsivenessScore: number;
  dataEntryDaysLast30: number;
  platformActiveDaysLast30: number;
  offersReceivedCount: number;
  offersRespondedWithin48h: number;
  creditBalancesOnTime: number;
  creditBalancesTotal: number;
  scoreUpdatedAt: string | null;
};

const SCORE_META: Record<
  ProducerScore,
  { emoji: string; label: string; color: string }
> = {
  excellent: { emoji: "⭐", label: "Excellent", color: "#1D9E75" },
  bon: { emoji: "✅", label: "Fiable", color: "#4A90D9" },
  nouveau: { emoji: "🆕", label: "Nouveau", color: "#B4B2A9" },
  attention: { emoji: "⚠️", label: "À surveiller", color: "#BA7517" },
  risque: { emoji: "🔴", label: "Risqué", color: "#E24B4A" }
};

const MS_30_DAYS = 30 * 86_400_000;
const MS_90_DAYS = 90 * 86_400_000;

@Injectable()
export class ProducerScoreService {
  private readonly logger = new Logger(ProducerScoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: ProducerScoreMetricsService
  ) {}

  async getForUser(userId: string): Promise<ProducerScoreView> {
    const row = await this.ensureProfile(userId);
    const stale =
      !row.scoreUpdatedAt ||
      Date.now() - row.scoreUpdatedAt.getTime() > MS_30_DAYS / 2;
    if (stale) {
      return this.recomputeForUser(userId);
    }
    return this.toView(row);
  }

  async recomputeForUser(userId: string): Promise<ProducerScoreView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, createdAt: true, lastActiveAt: true, reputationScore: true }
    });
    if (!user) {
      throw new Error(`User ${userId} introuvable`);
    }

    const since30 = new Date(Date.now() - MS_30_DAYS);
    const since90 = new Date(Date.now() - MS_90_DAYS);
    const farmIds = await this.metrics.getOwnedFarmIds(userId);

    const dataEntryDays = await this.metrics.collectDataEntryDays(
      userId,
      farmIds,
      since30
    );
    const platformActiveDays = await this.metrics.collectPlatformActiveDays(
      userId,
      farmIds,
      since30,
      user.lastActiveAt
    );
    const offerStats = await this.metrics.collectOfferResponsiveness(
      userId,
      since90
    );
    const creditStats = await this.metrics.collectCreditBalancePunctuality(
      userId,
      since90
    );

    const dataRegularityScore = scoreFromActiveDays(dataEntryDays, 20);
    const platformUsageScore = scoreFromActiveDays(platformActiveDays, 15);
    const responsivenessScore = scoreResponsiveness({
      offersReceived: offerStats.offersReceived,
      offersRespondedWithin48h: offerStats.offersRespondedWithin48h,
      creditBalancesOnTime: creditStats.creditBalancesOnTime,
      creditBalancesTotal: creditStats.creditBalancesTotal,
      reputationScore: user.reputationScore
    });

    const isNew = this.metrics.isNewProducer({
      userCreatedAt: user.createdAt,
      dataEntryDays,
      offersReceived: offerStats.offersReceived,
      creditBalancesTotal: creditStats.creditBalancesTotal
    });

    const producerScore = deriveProducerScore(
      {
        dataRegularity: dataRegularityScore,
        platformUsage: platformUsageScore,
        responsiveness: responsivenessScore
      },
      isNew
    );

    const now = new Date();
    const updated = await this.prisma.producerProfile.upsert({
      where: { userId },
      create: {
        userId,
        producerScore,
        dataRegularityScore,
        platformUsageScore,
        responsivenessScore,
        dataEntryDaysLast30: dataEntryDays,
        platformActiveDaysLast30: platformActiveDays,
        offersReceivedCount: offerStats.offersReceived,
        offersRespondedWithin48h: offerStats.offersRespondedWithin48h,
        creditBalancesOnTime: creditStats.creditBalancesOnTime,
        creditBalancesTotal: creditStats.creditBalancesTotal,
        scoreUpdatedAt: now
      },
      update: {
        producerScore,
        dataRegularityScore,
        platformUsageScore,
        responsivenessScore,
        dataEntryDaysLast30: dataEntryDays,
        platformActiveDaysLast30: platformActiveDays,
        offersReceivedCount: offerStats.offersReceived,
        offersRespondedWithin48h: offerStats.offersRespondedWithin48h,
        creditBalancesOnTime: creditStats.creditBalancesOnTime,
        creditBalancesTotal: creditStats.creditBalancesTotal,
        scoreUpdatedAt: now
      }
    });

    return this.toView(updated);
  }

  async recomputeAllStale(): Promise<void> {
    const since = new Date(Date.now() - MS_30_DAYS);
    const owners = await this.prisma.farm.findMany({
      where: { status: "active" },
      select: { ownerId: true },
      distinct: ["ownerId"]
    });

    let updated = 0;
    for (const { ownerId } of owners) {
      try {
        await this.recomputeForUser(ownerId);
        updated += 1;
      } catch (err) {
        this.logger.warn(`Score producteur ${ownerId}: ${String(err)}`);
      }
    }

    const staleProfiles = await this.prisma.producerProfile.findMany({
      where: {
        OR: [{ scoreUpdatedAt: null }, { scoreUpdatedAt: { lt: since } }]
      },
      select: { userId: true }
    });
    for (const row of staleProfiles) {
      if (owners.some((o) => o.ownerId === row.userId)) continue;
      try {
        await this.recomputeForUser(row.userId);
        updated += 1;
      } catch (err) {
        this.logger.warn(`Score producteur ${row.userId}: ${String(err)}`);
      }
    }

    this.logger.log(`Scores producteurs recalculés: ${updated}`);
  }

  private async ensureProfile(userId: string) {
    return this.prisma.producerProfile.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });
  }

  private toView(row: {
    producerScore: ProducerScore;
    dataRegularityScore: number;
    platformUsageScore: number;
    responsivenessScore: number;
    dataEntryDaysLast30: number;
    platformActiveDaysLast30: number;
    offersReceivedCount: number;
    offersRespondedWithin48h: number;
    creditBalancesOnTime: number;
    creditBalancesTotal: number;
    scoreUpdatedAt: Date | null;
  }): ProducerScoreView {
    const meta = SCORE_META[row.producerScore];
    return {
      score: row.producerScore,
      emoji: meta.emoji,
      label: meta.label,
      color: meta.color,
      globalValue: globalProducerScoreValue({
        dataRegularity: row.dataRegularityScore,
        platformUsage: row.platformUsageScore,
        responsiveness: row.responsivenessScore
      }),
      dataRegularityScore: row.dataRegularityScore,
      platformUsageScore: row.platformUsageScore,
      responsivenessScore: row.responsivenessScore,
      dataEntryDaysLast30: row.dataEntryDaysLast30,
      platformActiveDaysLast30: row.platformActiveDaysLast30,
      offersReceivedCount: row.offersReceivedCount,
      offersRespondedWithin48h: row.offersRespondedWithin48h,
      creditBalancesOnTime: row.creditBalancesOnTime,
      creditBalancesTotal: row.creditBalancesTotal,
      scoreUpdatedAt: row.scoreUpdatedAt?.toISOString() ?? null
    };
  }
}

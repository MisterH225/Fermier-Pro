import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ProducerScore } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProducerScoreMetricsService } from "./producer-score-metrics.service";
import {
  deriveProducerScore,
  evaluateProducerCreditEligibility,
  globalProducerScoreValue,
  scoreFromActiveDays,
  scoreResponsiveness,
  type ProducerCreditEligibility
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
  chatBuyerMessagesCount: number;
  chatRepliedWithin24h: number;
  creditSalesAllowed: boolean;
  creditSalesLimited: boolean;
  creditBlocked: boolean;
  creditBlockedReason: string | null;
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
    const chatStats = await this.metrics.collectChatResponsiveness(
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
      chatBuyerMessages: chatStats.chatBuyerMessages,
      chatRepliedWithin24h: chatStats.chatRepliedWithin24h,
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
    const existing = await this.prisma.producerProfile.findUnique({
      where: { userId },
      select: { creditBlocked: true, creditBlockedReason: true }
    });
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
        chatBuyerMessagesCount: chatStats.chatBuyerMessages,
        chatRepliedWithin24h: chatStats.chatRepliedWithin24h,
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
        chatBuyerMessagesCount: chatStats.chatBuyerMessages,
        chatRepliedWithin24h: chatStats.chatRepliedWithin24h,
        scoreUpdatedAt: now
      }
    });

    return this.toView({
      ...updated,
      creditBlocked: existing?.creditBlocked ?? updated.creditBlocked,
      creditBlockedReason:
        existing?.creditBlockedReason ?? updated.creditBlockedReason
    });
  }

  async getCreditEligibility(userId: string): Promise<ProducerCreditEligibility> {
    const row = await this.ensureProfile(userId);
    const view = await this.getForUser(userId);
    return evaluateProducerCreditEligibility({
      creditBlocked: row.creditBlocked,
      producerScore: view.score
    });
  }

  async assertSellerCreditSalesAllowed(sellerUserId: string): Promise<void> {
    const eligibility = await this.getCreditEligibility(sellerUserId);
    if (!eligibility.allowed) {
      throw new ForbiddenException(
        "Ce producteur n'est pas éligible aux ventes à crédit pour le moment"
      );
    }
  }

  async listForAdmin(opts?: { score?: ProducerScore; limit?: number }) {
    const take = Math.min(opts?.limit ?? 50, 100);
    const rows = await this.prisma.producerProfile.findMany({
      where: opts?.score ? { producerScore: opts.score } : undefined,
      orderBy: { scoreUpdatedAt: "desc" },
      take,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            reputationScore: true
          }
        }
      }
    });
    return rows.map((row) => ({
      ...this.toView(row),
      userId: row.userId,
      user: row.user
    }));
  }

  async adminSetCreditBlocked(
    userId: string,
    blocked: boolean,
    reason?: string | null
  ): Promise<ProducerScoreView> {
    const updated = await this.prisma.producerProfile.upsert({
      where: { userId },
      create: {
        userId,
        creditBlocked: blocked,
        creditBlockedReason: blocked ? reason?.trim() || null : null
      },
      update: {
        creditBlocked: blocked,
        creditBlockedReason: blocked ? reason?.trim() || null : null
      }
    });
    return this.toView(updated);
  }

  @Cron("0 3 * * *")
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
    chatBuyerMessagesCount: number;
    chatRepliedWithin24h: number;
    creditBlocked: boolean;
    creditBlockedReason: string | null;
    scoreUpdatedAt: Date | null;
  }): ProducerScoreView {
    const meta = SCORE_META[row.producerScore];
    const credit = evaluateProducerCreditEligibility({
      creditBlocked: row.creditBlocked,
      producerScore: row.producerScore
    });
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
      chatBuyerMessagesCount: row.chatBuyerMessagesCount,
      chatRepliedWithin24h: row.chatRepliedWithin24h,
      creditSalesAllowed: credit.allowed,
      creditSalesLimited: credit.limited,
      creditBlocked: row.creditBlocked,
      creditBlockedReason: row.creditBlockedReason,
      scoreUpdatedAt: row.scoreUpdatedAt?.toISOString() ?? null
    };
  }
}

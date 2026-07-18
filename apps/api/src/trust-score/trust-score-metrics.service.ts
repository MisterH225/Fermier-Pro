import { Injectable } from "@nestjs/common";
import {
  MarketplaceDeliveryDisputeStatus,
  MarketplaceTransactionStatus,
  MerchantOrderDisputeStatus,
  MerchantOrderStatus,
  VetAppointmentStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProducerScoreMetricsService } from "../producer-score/producer-score-metrics.service";
import { scoreFromActiveDays } from "../producer-score/producer-score.util";
import {
  TRUST_PILLAR_WEIGHTS,
  TRUST_SCORE_BEHAVIOR_WINDOW_DAYS
} from "./trust-score.constants";
import {
  bayesianRatingScore,
  failureRateToScore,
  rateToScore,
  type PillarInput
} from "./trust-score.util";

/**
 * Réactivité producteur v2 — même signaux que v1 SAUF reputationScore
 * (exclu pour éviter le double comptage des annulations).
 * Poids v1 sans réputation redistribués : offres 0.5, crédit 0.286, chat 0.214.
 */
function scoreResponsivenessV2(input: {
  offersReceived: number;
  offersRespondedWithin48h: number;
  creditBalancesOnTime: number;
  creditBalancesTotal: number;
  chatBuyerMessages: number;
  chatRepliedWithin24h: number;
}): number {
  let offerComponent = 70;
  if (input.offersReceived > 0) {
    offerComponent = Math.round(
      (input.offersRespondedWithin48h / input.offersReceived) * 100
    );
  }

  let creditComponent = 70;
  if (input.creditBalancesTotal > 0) {
    creditComponent = Math.round(
      (input.creditBalancesOnTime / input.creditBalancesTotal) * 100
    );
  }

  let chatComponent = 70;
  if (input.chatBuyerMessages > 0) {
    chatComponent = Math.round(
      (input.chatRepliedWithin24h / input.chatBuyerMessages) * 100
    );
  }

  return Math.round(
    offerComponent * 0.5 + creditComponent * 0.286 + chatComponent * 0.214
  );
}

const MS_DAY = 86_400_000;

/**
 * Collecte les signaux trust-score v2.
 *
 * Litiges : seuls ceux RÉSOLUS CONTRE l'utilisateur comptent.
 * - Escrow livraison : resolved_buyer ⇒ contre vendeur ; resolved_vendor ⇒ contre acheteur.
 *   resolved_split / cancelled : PAS de perdant clair → exclus.
 * - Poids (WEIGHT_ARBITRATED) : la résolution n'encode PAS de perdant
 *   (fixe seulement arbitrationWeightKg) → exclus, pas d'heuristique.
 * - MerchantOrderDispute : resolved_buyer ⇒ contre vendeur ; resolved_seller ⇒ contre acheteur.
 *
 * User.reputationScore : EXCLU (pénalités d'annulation déjà mesurées ici ;
 * n'est PAS alimenté par les avis).
 */
@Injectable()
export class TrustScoreMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly producerMetrics: ProducerScoreMetricsService
  ) {}

  behaviorSince(now = new Date()): Date {
    return new Date(
      now.getTime() - TRUST_SCORE_BEHAVIOR_WINDOW_DAYS * MS_DAY
    );
  }

  async collectProducerPillars(
    userId: string,
    now = new Date()
  ): Promise<{ pillars: PillarInput[]; transactionCount: number }> {
    const since = this.behaviorSince(now);
    const since30 = new Date(now.getTime() - 30 * MS_DAY);
    const farmIds = await this.producerMetrics.getOwnedFarmIds(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastActiveAt: true }
    });

    const dataEntryDays = await this.producerMetrics.collectDataEntryDays(
      userId,
      farmIds,
      since30
    );
    const offerStats = await this.producerMetrics.collectOfferResponsiveness(
      userId,
      since
    );
    const creditStats =
      await this.producerMetrics.collectCreditBalancePunctuality(userId, since);
    const chatStats = await this.producerMetrics.collectChatResponsiveness(
      userId,
      since
    );

    // Réactivité SANS reputationScore (évite double comptage des annulations).
    const responsiveness = scoreResponsivenessV2({
      offersReceived: offerStats.offersReceived,
      offersRespondedWithin48h: offerStats.offersRespondedWithin48h,
      creditBalancesOnTime: creditStats.creditBalancesOnTime,
      creditBalancesTotal: creditStats.creditBalancesTotal,
      chatBuyerMessages: chatStats.chatBuyerMessages,
      chatRepliedWithin24h: chatStats.chatRepliedWithin24h
    });

    const commercial = await this.collectProducerCommercial(userId, farmIds, since);

    const weights = TRUST_PILLAR_WEIGHTS.producer;
    const pillars: PillarInput[] = [
      {
        key: "dataRegularity",
        score: scoreFromActiveDays(dataEntryDays, 20),
        weight: weights.dataRegularity,
        sampleSize: dataEntryDays,
        hasData: dataEntryDays > 0 || farmIds.length > 0
      },
      {
        key: "responsiveness",
        score: responsiveness,
        weight: weights.responsiveness,
        sampleSize:
          offerStats.offersReceived +
          creditStats.creditBalancesTotal +
          chatStats.chatBuyerMessages,
        hasData:
          offerStats.offersReceived +
            creditStats.creditBalancesTotal +
            chatStats.chatBuyerMessages >
            0 || Boolean(user?.lastActiveAt)
      },
      {
        key: "commercialTrust",
        score: commercial.score,
        weight: weights.commercialTrust,
        sampleSize: commercial.sampleSize,
        hasData: commercial.hasData
      }
    ];

    // Si régularité sans aucune saisie mais fermes actives → hasData true avec score bas.
    if (farmIds.length > 0 && dataEntryDays === 0) {
      pillars[0]!.hasData = true;
      pillars[0]!.score = scoreFromActiveDays(0, 20);
    }

    return { pillars, transactionCount: commercial.transactionCount };
  }

  private async collectProducerCommercial(
    userId: string,
    farmIds: string[],
    since: Date
  ): Promise<{
    score: number | null;
    sampleSize: number;
    hasData: boolean;
    transactionCount: number;
  }> {
    const [ratings, txs, lostDisputes] = await Promise.all([
      farmIds.length
        ? this.prisma.farmMarketRating.findMany({
            where: { farmId: { in: farmIds } },
            select: { score: true }
          })
        : Promise.resolve([] as Array<{ score: number }>),
      this.prisma.marketplaceTransaction.findMany({
        where: {
          sellerUserId: userId,
          createdAt: { gte: since }
        },
        select: {
          status: true,
          weightDeclaredByBuyerAt: true,
          weightDisputeOpenedAt: true,
          weightValidatedAt: true
        }
      }),
      this.prisma.marketplaceDeliveryDispute.count({
        where: {
          listing: { sellerUserId: userId },
          status: MarketplaceDeliveryDisputeStatus.resolved_buyer,
          resolvedAt: { gte: since }
        }
      })
    ]);

    const ratingScore = bayesianRatingScore(ratings.map((r) => r.score));
    const closedStatuses: MarketplaceTransactionStatus[] = [
      MarketplaceTransactionStatus.TRANSACTION_CLOSED,
      MarketplaceTransactionStatus.BUYER_RECEIVED,
      MarketplaceTransactionStatus.WEIGHT_VALIDATED
    ];
    const closed = txs.filter((t) => closedStatuses.includes(t.status));
    const closedWithoutLostDispute = Math.max(0, closed.length - lostDisputes);
    const escrowClean = rateToScore(closedWithoutLostDispute, closed.length);

    const sellerCancels = txs.filter(
      (t) =>
        t.status === MarketplaceTransactionStatus.CANCELLED_BY_SELLER ||
        t.status === MarketplaceTransactionStatus.CANCELLED_SOLD_TO_OTHER
    ).length;
    const cancelScore = failureRateToScore(sellerCancels, txs.length);

    // Poids validés sans contre-déclaration acheteur ni ouverture de litige poids.
    const weightValidated = txs.filter((t) => t.weightValidatedAt != null);
    const withoutCounter = weightValidated.filter(
      (t) =>
        t.weightDeclaredByBuyerAt == null && t.weightDisputeOpenedAt == null
    ).length;
    const weightScore = rateToScore(withoutCounter, weightValidated.length);

    const components: Array<{ score: number; w: number }> = [];
    if (ratingScore != null) components.push({ score: ratingScore, w: 0.35 });
    if (escrowClean.hasData && escrowClean.score != null) {
      components.push({ score: escrowClean.score, w: 0.3 });
    }
    if (cancelScore.hasData && cancelScore.score != null) {
      components.push({ score: cancelScore.score, w: 0.2 });
    }
    if (weightScore.hasData && weightScore.score != null) {
      components.push({ score: weightScore.score, w: 0.15 });
    }

    if (components.length === 0) {
      return {
        score: null,
        sampleSize: 0,
        hasData: false,
        transactionCount: txs.length
      };
    }
    const tw = components.reduce((s, c) => s + c.w, 0);
    const score = Math.round(
      components.reduce((s, c) => s + c.score * (c.w / tw), 0)
    );
    return {
      score,
      sampleSize: ratings.length + txs.length,
      hasData: true,
      transactionCount: txs.length
    };
  }

  async collectBuyerPillars(
    userId: string,
    now = new Date()
  ): Promise<{ pillars: PillarInput[]; transactionCount: number }> {
    const since = this.behaviorSince(now);
    const txs = await this.prisma.marketplaceTransaction.findMany({
      where: { buyerUserId: userId, createdAt: { gte: since } },
      select: {
        status: true,
        buyerReceivedAt: true,
        sellerShippedAt: true,
        offerExpiresAt: true
      }
    });

    const paymentAttempts = txs.filter(
      (t) =>
        t.status === MarketplaceTransactionStatus.PAYMENT_FAILED ||
        t.status === MarketplaceTransactionStatus.PAYMENT_HELD ||
        t.status === MarketplaceTransactionStatus.PAYMENT_PENDING ||
        t.status === MarketplaceTransactionStatus.TRANSACTION_CLOSED ||
        t.status === MarketplaceTransactionStatus.BUYER_RECEIVED ||
        t.status === MarketplaceTransactionStatus.WEIGHT_VALIDATED ||
        t.status === MarketplaceTransactionStatus.CANCELLED_BY_BUYER ||
        t.status === MarketplaceTransactionStatus.CANCELLED_BY_SELLER
    );
    const paymentFailed = paymentAttempts.filter(
      (t) => t.status === MarketplaceTransactionStatus.PAYMENT_FAILED
    ).length;
    const payment = failureRateToScore(paymentFailed, paymentAttempts.length);

    // Confirmations de réception dans les délais (14 j après expédition).
    const shipped = txs.filter((t) => t.sellerShippedAt != null);
    const onTimeReceipts = shipped.filter((t) => {
      if (!t.buyerReceivedAt || !t.sellerShippedAt) return false;
      const deadline =
        t.sellerShippedAt.getTime() + 14 * MS_DAY;
      return t.buyerReceivedAt.getTime() <= deadline;
    }).length;
    const receipt = rateToScore(onTimeReceipts, shipped.length);

    const lostDisputes = await this.prisma.marketplaceDeliveryDispute.count({
      where: {
        raisedByUserId: userId,
        status: MarketplaceDeliveryDisputeStatus.resolved_vendor,
        resolvedAt: { gte: since }
      }
    });
    // Aussi litiges où l'acheteur est partie et a perdu (resolved_vendor).
    const disputesAgainstBuyer =
      await this.prisma.marketplaceDeliveryDispute.count({
        where: {
          transaction: { buyerUserId: userId },
          status: MarketplaceDeliveryDisputeStatus.resolved_vendor,
          resolvedAt: { gte: since }
        }
      });
    const disputeLost = Math.max(lostDisputes, disputesAgainstBuyer);
    const dispute = failureRateToScore(disputeLost, txs.length);

    const buyerCancels = txs.filter(
      (t) => t.status === MarketplaceTransactionStatus.CANCELLED_BY_BUYER
    ).length;
    const cancel = failureRateToScore(buyerCancels, txs.length);

    const w = TRUST_PILLAR_WEIGHTS.buyer;
    const pillars: PillarInput[] = [
      {
        key: "paymentReliability",
        score: payment.score,
        weight: w.paymentReliability,
        sampleSize: paymentAttempts.length,
        hasData: payment.hasData
      },
      {
        key: "receiptTimeliness",
        score: receipt.score,
        weight: w.receiptTimeliness,
        sampleSize: shipped.length,
        hasData: receipt.hasData
      },
      {
        key: "disputeRecord",
        score: dispute.score,
        weight: w.disputeRecord,
        sampleSize: txs.length,
        hasData: dispute.hasData
      },
      {
        key: "cancellationRate",
        score: cancel.score,
        weight: w.cancellationRate,
        sampleSize: txs.length,
        hasData: cancel.hasData
      }
    ];

    return { pillars, transactionCount: txs.length };
  }

  async collectMerchantPillars(
    userId: string,
    now = new Date()
  ): Promise<{ pillars: PillarInput[]; transactionCount: number }> {
    const since = this.behaviorSince(now);
    const orders = await this.prisma.merchantOrder.findMany({
      where: { sellerUserId: userId, createdAt: { gte: since } },
      select: {
        status: true,
        createdAt: true,
        confirmedAt: true,
        shippedAt: true
      }
    });

    // Auto-annulation timeout pèse double dans le dénominateur effectif.
    let receivedWeight = 0;
    let honoredWeight = 0;
    for (const o of orders) {
      if (o.status === MerchantOrderStatus.payment_pending) continue;
      if (o.status === MerchantOrderStatus.failed) continue;
      if (o.status === MerchantOrderStatus.auto_rejected) {
        receivedWeight += 2;
        continue;
      }
      receivedWeight += 1;
      if (
        o.status === MerchantOrderStatus.confirmed ||
        o.status === MerchantOrderStatus.shipping ||
        o.status === MerchantOrderStatus.delivered ||
        o.status === MerchantOrderStatus.completed
      ) {
        honoredWeight += 1;
      }
    }
    const fulfillment = rateToScore(honoredWeight, receivedWeight);

    const confirmable = orders.filter((o) => o.confirmedAt != null);
    let speedScore: number | null = null;
    if (confirmable.length > 0) {
      const avgHours =
        confirmable.reduce((s, o) => {
          const h =
            (o.confirmedAt!.getTime() - o.createdAt.getTime()) / 3_600_000;
          return s + h;
        }, 0) / confirmable.length;
      // ≤ 6 h → 100 ; ≥ 72 h → 20
      speedScore = Math.max(
        20,
        Math.min(100, Math.round(100 - ((avgHours - 6) / 66) * 80))
      );
    }

    const lostDisputes = await this.prisma.merchantOrderDispute.count({
      where: {
        order: { sellerUserId: userId },
        status: MerchantOrderDisputeStatus.resolved_buyer,
        resolvedAt: { gte: since }
      }
    });
    const dispute = failureRateToScore(lostDisputes, orders.length);

    const w = TRUST_PILLAR_WEIGHTS.merchant;
    const pillars: PillarInput[] = [
      {
        key: "orderFulfillment",
        score: fulfillment.score,
        weight: w.orderFulfillment,
        sampleSize: orders.length,
        hasData: fulfillment.hasData
      },
      {
        key: "confirmationSpeed",
        score: speedScore,
        weight: w.confirmationSpeed,
        sampleSize: confirmable.length,
        hasData: speedScore != null
      },
      {
        key: "disputeRecord",
        score: dispute.score,
        weight: w.disputeRecord,
        sampleSize: orders.length,
        hasData: dispute.hasData
      }
    ];

    return { pillars, transactionCount: orders.length };
  }

  async collectVetPillars(
    userId: string,
    now = new Date()
  ): Promise<{ pillars: PillarInput[]; transactionCount: number }> {
    const since = this.behaviorSince(now);
    const vet = await this.prisma.vetProfile.findUnique({
      where: { userId },
      select: { id: true }
    });
    if (!vet) {
      return { pillars: this.emptyVetPillars(), transactionCount: 0 };
    }

    const [vetRatings, apptRatings, appointments] = await Promise.all([
      this.prisma.vetRating.findMany({
        where: { vetId: vet.id },
        select: { score: true }
      }),
      this.prisma.vetAppointmentRating.findMany({
        where: { vetProfileId: vet.id },
        select: { rating: true }
      }),
      this.prisma.vetAppointment.findMany({
        where: { vetUserId: userId, requestedAt: { gte: since } },
        select: {
          status: true,
          requestedAt: true,
          confirmedAt: true
        }
      })
    ]);

    const allRatings = [
      ...vetRatings.map((r) => r.score),
      ...apptRatings.map((r) => r.rating)
    ];
    const ratingsScore = bayesianRatingScore(allRatings);

    const terminalStatuses: VetAppointmentStatus[] = [
      VetAppointmentStatus.APPOINTMENT_COMPLETED,
      VetAppointmentStatus.APPOINTMENT_RATED,
      VetAppointmentStatus.CANCELLED_BY_VET,
      VetAppointmentStatus.APPOINTMENT_REFUSED
    ];
    const terminal = appointments.filter((a) =>
      terminalStatuses.includes(a.status)
    );
    const honored = terminal.filter(
      (a) =>
        a.status === VetAppointmentStatus.APPOINTMENT_COMPLETED ||
        a.status === VetAppointmentStatus.APPOINTMENT_RATED
    ).length;
    const honor = rateToScore(honored, terminal.length);

    const confirmed = appointments.filter((a) => a.confirmedAt != null);
    let reactivity: number | null = null;
    if (confirmed.length > 0) {
      const avgHours =
        confirmed.reduce((s, a) => {
          const h =
            (a.confirmedAt!.getTime() - a.requestedAt.getTime()) / 3_600_000;
          return s + h;
        }, 0) / confirmed.length;
      reactivity = Math.max(
        20,
        Math.min(100, Math.round(100 - ((avgHours - 2) / 46) * 80))
      );
    }

    const w = TRUST_PILLAR_WEIGHTS.vet;
    const pillars: PillarInput[] = [
      {
        key: "ratings",
        score: ratingsScore,
        weight: w.ratings,
        sampleSize: allRatings.length,
        hasData: ratingsScore != null
      },
      {
        key: "appointmentHonor",
        score: honor.score,
        weight: w.appointmentHonor,
        sampleSize: terminal.length,
        hasData: honor.hasData
      },
      {
        key: "requestReactivity",
        score: reactivity,
        weight: w.requestReactivity,
        sampleSize: confirmed.length,
        hasData: reactivity != null
      }
    ];

    return { pillars, transactionCount: appointments.length };
  }

  async collectTechnicianPillars(
    userId: string,
    now = new Date()
  ): Promise<{ pillars: PillarInput[]; transactionCount: number }> {
    const since = this.behaviorSince(now);
    const since30 = new Date(now.getTime() - 30 * MS_DAY);

    const memberships = await this.prisma.farmMembership.findMany({
      where: { userId },
      select: { id: true, farmId: true }
    });
    const memberIds = memberships.map((m) => m.id);
    const farmIds = memberships.map((m) => m.farmId);

    const [tasksCompleted, healthRecords, activityLogs] = await Promise.all([
      farmIds.length
        ? this.prisma.farmTask.count({
            where: {
              farmId: { in: farmIds },
              completedByUserId: userId,
              completedAt: { gte: since }
            }
          })
        : Promise.resolve(0),
      farmIds.length
        ? this.prisma.farmHealthRecord.count({
            where: {
              farmId: { in: farmIds },
              recordedByUserId: userId,
              createdAt: { gte: since }
            }
          })
        : Promise.resolve(0),
      memberIds.length
        ? this.prisma.memberActivityLog.findMany({
            where: { memberId: { in: memberIds }, createdAt: { gte: since30 } },
            select: { createdAt: true }
          })
        : Promise.resolve([] as Array<{ createdAt: Date }>)
    ]);

    const interventions = tasksCompleted + healthRecords;
    // 10 interventions / 90 j → 100
    const activityScore =
      interventions > 0
        ? Math.min(100, Math.round((interventions / 10) * 100))
        : null;

    const activeDays = new Set(
      activityLogs.map((l) => l.createdAt.toISOString().slice(0, 10))
    ).size;
    const regularity =
      activeDays > 0 || interventions > 0
        ? scoreFromActiveDays(activeDays, 12)
        : null;

    const w = TRUST_PILLAR_WEIGHTS.technician;
    const pillars: PillarInput[] = [
      {
        key: "followUpActivity",
        score: activityScore,
        weight: w.followUpActivity,
        sampleSize: interventions,
        hasData: activityScore != null
      },
      {
        key: "regularity",
        score: regularity,
        weight: w.regularity,
        sampleSize: activeDays,
        hasData: regularity != null
      }
    ];

    return { pillars, transactionCount: interventions };
  }

  private emptyVetPillars(): PillarInput[] {
    const w = TRUST_PILLAR_WEIGHTS.vet;
    return [
      {
        key: "ratings",
        score: null,
        weight: w.ratings,
        sampleSize: 0,
        hasData: false
      },
      {
        key: "appointmentHonor",
        score: null,
        weight: w.appointmentHonor,
        sampleSize: 0,
        hasData: false
      },
      {
        key: "requestReactivity",
        score: null,
        weight: w.requestReactivity,
        sampleSize: 0,
        hasData: false
      }
    ];
  }
}

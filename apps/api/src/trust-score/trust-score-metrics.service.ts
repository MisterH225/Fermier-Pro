import { Injectable } from "@nestjs/common";
import {
  MarketplaceDeliveryDisputeStatus,
  MarketplaceTransactionStatus,
  MerchantOrderDisputeStatus,
  MerchantOrderStatus,
  TrustScoreLevel,
  TrustScoreProfileType,
  VetAppointmentStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProducerScoreMetricsService } from "../producer-score/producer-score-metrics.service";
import { scoreFromActiveDays } from "../producer-score/producer-score.util";
import {
  TRUST_PILLAR_WEIGHTS,
  TRUST_SCORE_BEHAVIOR_WINDOW_DAYS,
  TRUST_SCORE_VERSION
} from "./trust-score.constants";
import {
  bayesianRatingScore,
  failureRateToScore,
  rateToScore,
  rawRatingAverage,
  type PillarEvidence,
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
 * Collecte les signaux trust-score v2 (+ preuves chiffrées E2).
 *
 * Litiges : seuls ceux RÉSOLUS CONTRE l'utilisateur comptent.
 * User.reputationScore : EXCLU.
 * Preuves : calculées sur la donnée brute — JAMAIS dérivées du score normalisé.
 *
 * Mapping preuves (commentaire PR) :
 * | Profil | Pilier | Source | Preuve |
 * | producer | dataRegularity | jours de saisie 30j | count (jours) |
 * | producer | responsiveness | offres/crédit/chat | null (composite) |
 * | producer | commercialTrust | avis+escrow+annul+poids | null (composite) ou rating si avis |
 * | buyer | ratings | BuyerRating | rating avg+count |
 * | buyer | paymentReliability | txs payment | ratio (ok / attempts) |
 * | buyer | receiptTimeliness | shipped+received | ratio (à l'heure / expédiées) |
 * | buyer | disputeRecord | litiges perdus | ratio (sans perte / txs) |
 * | buyer | cancellationRate | CANCELLED_BY_BUYER | ratio (sans annul / txs) |
 * | merchant | ratings | MerchantRating | rating |
 * | merchant | orderFulfillment | orders honorées | ratio |
 * | merchant | confirmationSpeed | confirmedAt-createdAt | duration (minutes) |
 * | merchant | disputeRecord | litiges perdus | ratio |
 * | vet | ratings | VetRating+ApptRating | rating |
 * | vet | appointmentHonor | RDV honorés | ratio |
 * | vet | requestReactivity | confirmedAt-requestedAt | duration |
 * | technician | ratings | TechnicianRating | rating |
 * | technician | followUpActivity | tasks+health | count |
 * | technician | regularity | jours actifs 30j | count |
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

  /**
   * Poids bayésien : un avis d'un compte « orageux » compte pour moitié.
   */
  private async stormyWeightsForAuthors(
    authorIds: string[],
    authorProfileType: TrustScoreProfileType
  ): Promise<number[]> {
    if (authorIds.length === 0) return [];
    const unique = [...new Set(authorIds)];
    const snaps = await this.prisma.trustScoreSnapshot.findMany({
      where: {
        userId: { in: unique },
        profileType: authorProfileType,
        scoreVersion: TRUST_SCORE_VERSION
      },
      orderBy: { computedAt: "desc" },
      select: { userId: true, level: true }
    });
    const levelByUser = new Map<string, TrustScoreLevel>();
    for (const s of snaps) {
      if (!levelByUser.has(s.userId)) {
        levelByUser.set(s.userId, s.level);
      }
    }
    return authorIds.map((id) =>
      levelByUser.get(id) === TrustScoreLevel.orageux ? 0.5 : 1
    );
  }

  private ratingsPillar(
    scores: number[],
    weights: number[],
    pillarWeight: number
  ): PillarInput {
    const bayes = bayesianRatingScore(scores, weights);
    const avg = rawRatingAverage(scores);
    const evidence: PillarEvidence =
      avg != null
        ? { kind: "rating", average: avg, count: scores.length }
        : null;
    return {
      key: "ratings",
      score: bayes,
      weight: pillarWeight,
      sampleSize: scores.length,
      hasData: bayes != null,
      evidence
    };
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

    const responsiveness = scoreResponsivenessV2({
      offersReceived: offerStats.offersReceived,
      offersRespondedWithin48h: offerStats.offersRespondedWithin48h,
      creditBalancesOnTime: creditStats.creditBalancesOnTime,
      creditBalancesTotal: creditStats.creditBalancesTotal,
      chatBuyerMessages: chatStats.chatBuyerMessages,
      chatRepliedWithin24h: chatStats.chatRepliedWithin24h
    });

    const commercial = await this.collectProducerCommercial(
      userId,
      farmIds,
      since
    );

    const weights = TRUST_PILLAR_WEIGHTS.producer;
    const pillars: PillarInput[] = [
      {
        key: "dataRegularity",
        score: scoreFromActiveDays(dataEntryDays, 20),
        weight: weights.dataRegularity,
        sampleSize: dataEntryDays,
        hasData: dataEntryDays > 0 || farmIds.length > 0,
        evidence: { kind: "count", value: dataEntryDays }
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
            0 || Boolean(user?.lastActiveAt),
        // Composite multi-signaux — pas de preuve simple unique
        evidence: null
      },
      {
        key: "commercialTrust",
        score: commercial.score,
        weight: weights.commercialTrust,
        sampleSize: commercial.sampleSize,
        hasData: commercial.hasData,
        evidence: commercial.evidence
      }
    ];

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
    evidence: PillarEvidence;
  }> {
    const [ratings, txs, lostDisputes] = await Promise.all([
      farmIds.length
        ? this.prisma.farmMarketRating.findMany({
            where: { farmId: { in: farmIds } },
            select: { score: true, ratedByUserId: true }
          })
        : Promise.resolve(
            [] as Array<{ score: number; ratedByUserId: string }>
          ),
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

    const stormyW = await this.stormyWeightsForAuthors(
      ratings.map((r) => r.ratedByUserId),
      TrustScoreProfileType.buyer
    );
    const ratingScore = bayesianRatingScore(
      ratings.map((r) => r.score),
      stormyW
    );
    const ratingAvg = rawRatingAverage(ratings.map((r) => r.score));

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

    // Preuve : si avis présents → rating ; sinon ratio escrow si disponible ; sinon null
    let evidence: PillarEvidence = null;
    if (ratingAvg != null) {
      evidence = {
        kind: "rating",
        average: ratingAvg,
        count: ratings.length
      };
    } else if (closed.length > 0) {
      evidence = {
        kind: "ratio",
        good: closedWithoutLostDispute,
        total: closed.length
      };
    }

    if (components.length === 0) {
      return {
        score: null,
        sampleSize: 0,
        hasData: false,
        transactionCount: txs.length,
        evidence: null
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
      transactionCount: txs.length,
      evidence
    };
  }

  async collectBuyerPillars(
    userId: string,
    now = new Date()
  ): Promise<{ pillars: PillarInput[]; transactionCount: number }> {
    const since = this.behaviorSince(now);
    const [txs, ratings] = await Promise.all([
      this.prisma.marketplaceTransaction.findMany({
        where: { buyerUserId: userId, createdAt: { gte: since } },
        select: {
          status: true,
          buyerReceivedAt: true,
          sellerShippedAt: true,
          offerExpiresAt: true
        }
      }),
      this.prisma.buyerRating.findMany({
        where: { buyerUserId: userId },
        select: { score: true, ratedByUserId: true }
      })
    ]);

    const stormyW = await this.stormyWeightsForAuthors(
      ratings.map((r) => r.ratedByUserId),
      TrustScoreProfileType.producer
    );

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
    const paymentOk = paymentAttempts.length - paymentFailed;
    const payment = failureRateToScore(paymentFailed, paymentAttempts.length);

    const shipped = txs.filter((t) => t.sellerShippedAt != null);
    const onTimeReceipts = shipped.filter((t) => {
      if (!t.buyerReceivedAt || !t.sellerShippedAt) return false;
      const deadline = t.sellerShippedAt.getTime() + 14 * MS_DAY;
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
    const disputesAgainstBuyer =
      await this.prisma.marketplaceDeliveryDispute.count({
        where: {
          transaction: { buyerUserId: userId },
          status: MarketplaceDeliveryDisputeStatus.resolved_vendor,
          resolvedAt: { gte: since }
        }
      });
    const disputeLost = Math.max(lostDisputes, disputesAgainstBuyer);
    const disputeOk = Math.max(0, txs.length - disputeLost);
    const dispute = failureRateToScore(disputeLost, txs.length);

    const buyerCancels = txs.filter(
      (t) => t.status === MarketplaceTransactionStatus.CANCELLED_BY_BUYER
    ).length;
    const cancelOk = Math.max(0, txs.length - buyerCancels);
    const cancel = failureRateToScore(buyerCancels, txs.length);

    const w = TRUST_PILLAR_WEIGHTS.buyer;
    const pillars: PillarInput[] = [
      this.ratingsPillar(
        ratings.map((r) => r.score),
        stormyW,
        w.ratings
      ),
      {
        key: "paymentReliability",
        score: payment.score,
        weight: w.paymentReliability,
        sampleSize: paymentAttempts.length,
        hasData: payment.hasData,
        evidence:
          paymentAttempts.length > 0
            ? { kind: "ratio", good: paymentOk, total: paymentAttempts.length }
            : null
      },
      {
        key: "receiptTimeliness",
        score: receipt.score,
        weight: w.receiptTimeliness,
        sampleSize: shipped.length,
        hasData: receipt.hasData,
        evidence:
          shipped.length > 0
            ? { kind: "ratio", good: onTimeReceipts, total: shipped.length }
            : null
      },
      {
        key: "disputeRecord",
        score: dispute.score,
        weight: w.disputeRecord,
        sampleSize: txs.length,
        hasData: dispute.hasData,
        evidence:
          txs.length > 0
            ? { kind: "ratio", good: disputeOk, total: txs.length }
            : null
      },
      {
        key: "cancellationRate",
        score: cancel.score,
        weight: w.cancellationRate,
        sampleSize: txs.length,
        hasData: cancel.hasData,
        evidence:
          txs.length > 0
            ? { kind: "ratio", good: cancelOk, total: txs.length }
            : null
      }
    ];

    return { pillars, transactionCount: txs.length };
  }

  async collectMerchantPillars(
    userId: string,
    now = new Date()
  ): Promise<{ pillars: PillarInput[]; transactionCount: number }> {
    const since = this.behaviorSince(now);
    const [orders, ratings] = await Promise.all([
      this.prisma.merchantOrder.findMany({
        where: { sellerUserId: userId, createdAt: { gte: since } },
        select: {
          status: true,
          createdAt: true,
          confirmedAt: true,
          shippedAt: true
        }
      }),
      this.prisma.merchantRating.findMany({
        where: { merchantUserId: userId },
        select: { score: true, ratedByUserId: true }
      })
    ]);

    const stormyW = await this.stormyWeightsForAuthors(
      ratings.map((r) => r.ratedByUserId),
      TrustScoreProfileType.buyer
    );

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
    let avgMinutes: number | null = null;
    if (confirmable.length > 0) {
      const avgHours =
        confirmable.reduce((s, o) => {
          const h =
            (o.confirmedAt!.getTime() - o.createdAt.getTime()) / 3_600_000;
          return s + h;
        }, 0) / confirmable.length;
      avgMinutes = Math.round(avgHours * 60);
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
    const disputeOk = Math.max(0, orders.length - lostDisputes);
    const dispute = failureRateToScore(lostDisputes, orders.length);

    const w = TRUST_PILLAR_WEIGHTS.merchant;
    const pillars: PillarInput[] = [
      this.ratingsPillar(
        ratings.map((r) => r.score),
        stormyW,
        w.ratings
      ),
      {
        key: "orderFulfillment",
        score: fulfillment.score,
        weight: w.orderFulfillment,
        sampleSize: orders.length,
        hasData: fulfillment.hasData,
        evidence:
          receivedWeight > 0
            ? { kind: "ratio", good: honoredWeight, total: receivedWeight }
            : null
      },
      {
        key: "confirmationSpeed",
        score: speedScore,
        weight: w.confirmationSpeed,
        sampleSize: confirmable.length,
        hasData: speedScore != null,
        evidence:
          avgMinutes != null
            ? { kind: "duration", averageMinutes: avgMinutes }
            : null
      },
      {
        key: "disputeRecord",
        score: dispute.score,
        weight: w.disputeRecord,
        sampleSize: orders.length,
        hasData: dispute.hasData,
        evidence:
          orders.length > 0
            ? { kind: "ratio", good: disputeOk, total: orders.length }
            : null
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
        select: { score: true, ratedByUserId: true }
      }),
      this.prisma.vetAppointmentRating.findMany({
        where: { vetProfileId: vet.id },
        select: { rating: true, producerUserId: true }
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
    const authorIds = [
      ...vetRatings.map((r) => r.ratedByUserId),
      ...apptRatings.map((r) => r.producerUserId)
    ];
    const stormyW = await this.stormyWeightsForAuthors(
      authorIds,
      TrustScoreProfileType.producer
    );
    const ratingsScore = bayesianRatingScore(allRatings, stormyW);
    const ratingAvg = rawRatingAverage(allRatings);

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
    let avgMinutes: number | null = null;
    if (confirmed.length > 0) {
      const avgHours =
        confirmed.reduce((s, a) => {
          const h =
            (a.confirmedAt!.getTime() - a.requestedAt.getTime()) / 3_600_000;
          return s + h;
        }, 0) / confirmed.length;
      avgMinutes = Math.round(avgHours * 60);
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
        hasData: ratingsScore != null,
        evidence:
          ratingAvg != null
            ? { kind: "rating", average: ratingAvg, count: allRatings.length }
            : null
      },
      {
        key: "appointmentHonor",
        score: honor.score,
        weight: w.appointmentHonor,
        sampleSize: terminal.length,
        hasData: honor.hasData,
        evidence:
          terminal.length > 0
            ? { kind: "ratio", good: honored, total: terminal.length }
            : null
      },
      {
        key: "requestReactivity",
        score: reactivity,
        weight: w.requestReactivity,
        sampleSize: confirmed.length,
        hasData: reactivity != null,
        evidence:
          avgMinutes != null
            ? { kind: "duration", averageMinutes: avgMinutes }
            : null
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

    const [tasksCompleted, healthRecords, activityLogs, ratings] =
      await Promise.all([
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
              where: {
                memberId: { in: memberIds },
                createdAt: { gte: since30 }
              },
              select: { createdAt: true }
            })
          : Promise.resolve([] as Array<{ createdAt: Date }>),
        this.prisma.technicianRating.findMany({
          where: { technicianUserId: userId },
          select: { score: true, ratedByUserId: true }
        })
      ]);

    const stormyW = await this.stormyWeightsForAuthors(
      ratings.map((r) => r.ratedByUserId),
      TrustScoreProfileType.producer
    );

    const interventions = tasksCompleted + healthRecords;
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
      this.ratingsPillar(
        ratings.map((r) => r.score),
        stormyW,
        w.ratings
      ),
      {
        key: "followUpActivity",
        score: activityScore,
        weight: w.followUpActivity,
        sampleSize: interventions,
        hasData: activityScore != null,
        evidence:
          interventions > 0 ? { kind: "count", value: interventions } : null
      },
      {
        key: "regularity",
        score: regularity,
        weight: w.regularity,
        sampleSize: activeDays,
        hasData: regularity != null,
        evidence: activeDays > 0 ? { kind: "count", value: activeDays } : null
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
        hasData: false,
        evidence: null
      },
      {
        key: "appointmentHonor",
        score: null,
        weight: w.appointmentHonor,
        sampleSize: 0,
        hasData: false,
        evidence: null
      },
      {
        key: "requestReactivity",
        score: null,
        weight: w.requestReactivity,
        sampleSize: 0,
        hasData: false,
        evidence: null
      }
    ];
  }
}

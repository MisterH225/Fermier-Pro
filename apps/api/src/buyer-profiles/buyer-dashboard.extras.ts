import {
  OfferStatus
} from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import {
  emptyProposalBucket,
  periodPairsAt,
  decimalToNumber,
  type ProposalBucket
} from "./buyer-dashboard.aggregations";
import {
  loadBuyerOpenCreditDues,
  type BuyerDashboardCreditDuesDto
} from "./buyer-credit.aggregation";
import {
  loadBuyerPurchaseRows,
  purchasesDtoFromRows,
  type BuyerDashboardPeriodKey
} from "./buyer-purchases.aggregation";

export type BuyerDashboardProposalsDto = {
  pending: ProposalBucket;
  countered: ProposalBucket;
  accepted: ProposalBucket;
  rejected: ProposalBucket;
};

export type { BuyerDashboardPurchasesDto } from "./buyer-purchases.aggregation";
export type {
  BuyerDashboardCreditDueItemDto,
  BuyerDashboardCreditDuesDto
} from "./buyer-credit.aggregation";

const PROPOSAL_STATUSES = [
  OfferStatus.pending,
  OfferStatus.countered,
  OfferStatus.accepted,
  OfferStatus.rejected
] as const;

/**
 * Blocs additifs du dashboard acheteur (propositions / achats / crédits).
 * Achats + crédits : mêmes loaders que le module finance acheteur (SSOT).
 */
export async function loadBuyerDashboardExtras(
  prisma: PrismaService,
  buyerUserId: string,
  now = new Date()
): Promise<{
  proposals: BuyerDashboardProposalsDto;
  purchases: import("./buyer-purchases.aggregation").BuyerDashboardPurchasesDto;
  creditDues: BuyerDashboardCreditDuesDto;
}> {
  const pairs = periodPairsAt(now);
  const yearPrevStart = pairs.year.previous.start;
  // Monthly chart needs 12 months; purchases DTO needs prev year start — take earlier.
  const twelveMonthsStart = new Date(
    now.getFullYear(),
    now.getMonth() - 11,
    1
  );
  const from =
    yearPrevStart.getTime() < twelveMonthsStart.getTime()
      ? yearPrevStart
      : twelveMonthsStart;

  const [offerGroups, purchaseRows, creditDues] = await Promise.all([
    prisma.marketplaceOffer.groupBy({
      by: ["status"],
      where: {
        buyerUserId,
        status: { in: [...PROPOSAL_STATUSES] }
      },
      _count: { _all: true },
      _sum: { offeredPrice: true }
    }),
    loadBuyerPurchaseRows(prisma, buyerUserId, from, now),
    loadBuyerOpenCreditDues(prisma, buyerUserId, now)
  ]);

  const proposals: BuyerDashboardProposalsDto = {
    pending: emptyProposalBucket(),
    countered: emptyProposalBucket(),
    accepted: emptyProposalBucket(),
    rejected: emptyProposalBucket()
  };
  for (const g of offerGroups) {
    const bucket =
      g.status === OfferStatus.pending
        ? proposals.pending
        : g.status === OfferStatus.countered
          ? proposals.countered
          : g.status === OfferStatus.accepted
            ? proposals.accepted
            : g.status === OfferStatus.rejected
              ? proposals.rejected
              : null;
    if (!bucket) continue;
    bucket.count = g._count._all;
    bucket.amount = decimalToNumber(g._sum.offeredPrice);
  }

  return {
    proposals,
    purchases: purchasesDtoFromRows(purchaseRows, now),
    creditDues
  };
}

/** Export pour tests unitaires. */
export const buyerDashboardExtrasTestUtils = {
  PROPOSAL_STATUSES
};

export type { BuyerDashboardPeriodKey };

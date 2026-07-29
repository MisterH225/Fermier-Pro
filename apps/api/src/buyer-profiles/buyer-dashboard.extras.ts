import {
  MarketplaceTransactionStatus,
  MerchantOrderStatus,
  OfferStatus
} from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import {
  buildPeriodTotals,
  decimalToNumber,
  emptyPeriodTotals,
  emptyProposalBucket,
  periodPairsAt,
  type BuyerDashboardPeriodKey,
  type PeriodTotals,
  type ProposalBucket
} from "./buyer-dashboard.aggregations";

export type BuyerDashboardProposalsDto = {
  pending: ProposalBucket;
  countered: ProposalBucket;
  accepted: ProposalBucket;
  rejected: ProposalBucket;
};

export type BuyerDashboardPurchasesDto = {
  currency: string;
  month: PeriodTotals;
  quarter: PeriodTotals;
  year: PeriodTotals;
};

export type BuyerDashboardCreditDueItemDto = {
  offerId: string;
  transactionId: string | null;
  sellerName: string;
  farmName: string | null;
  listingTitle: string;
  amountDue: number;
  balanceDueAt: string | null;
  overdue: boolean;
  status: string;
  currency: string;
};

export type BuyerDashboardCreditDuesDto = {
  totalDue: number;
  currency: string;
  items: BuyerDashboardCreditDueItemDto[];
};

const PROPOSAL_STATUSES = [
  OfferStatus.pending,
  OfferStatus.countered,
  OfferStatus.accepted,
  OfferStatus.rejected
] as const;

const CREDIT_DUE_STATUSES: OfferStatus[] = [
  OfferStatus.balance_pending,
  OfferStatus.balance_declared,
  OfferStatus.arbitration
];

function displaySellerName(seller: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
} | null): string {
  if (!seller) return "Vendeur";
  const full = seller.fullName?.trim();
  if (full) return full;
  const parts = [seller.firstName, seller.lastName]
    .map((p) => p?.trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return "Vendeur";
}

function sumInWindow(
  rows: Array<{ amount: number; at: Date }>,
  start: Date,
  end: Date
): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const row of rows) {
    if (row.at >= start && row.at < end) {
      total += row.amount;
      count += 1;
    }
  }
  return { total, count };
}

/**
 * Blocs additifs du dashboard acheteur (propositions / achats / crédits).
 */
export async function loadBuyerDashboardExtras(
  prisma: PrismaService,
  buyerUserId: string,
  now = new Date()
): Promise<{
  proposals: BuyerDashboardProposalsDto;
  purchases: BuyerDashboardPurchasesDto;
  creditDues: BuyerDashboardCreditDuesDto;
}> {
  const pairs = periodPairsAt(now);
  const yearPrevStart = pairs.year.previous.start;

  const [offerGroups, escrowClosed, shopCompleted, creditRows] =
    await Promise.all([
      prisma.marketplaceOffer.groupBy({
        by: ["status"],
        where: {
          buyerUserId,
          status: { in: [...PROPOSAL_STATUSES] }
        },
        _count: { _all: true },
        _sum: { offeredPrice: true }
      }),
      prisma.marketplaceTransaction.findMany({
        where: {
          buyerUserId,
          status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
          closedAt: { gte: yearPrevStart, lt: now }
        },
        select: {
          finalAmount: true,
          blockedAmount: true,
          closedAt: true,
          currency: true
        }
      }),
      prisma.merchantOrder.findMany({
        where: {
          buyerUserId,
          status: MerchantOrderStatus.completed,
          completedAt: { gte: yearPrevStart, lt: now }
        },
        select: {
          totalAmount: true,
          completedAt: true,
          product: { select: { currency: true } }
        }
      }),
      prisma.marketplaceOffer.findMany({
        where: {
          buyerUserId,
          status: { in: CREDIT_DUE_STATUSES },
          balanceAmount: { gt: 0 }
        },
        orderBy: [{ balanceDueAt: "asc" }, { updatedAt: "desc" }],
        include: {
          listing: {
            select: {
              title: true,
              currency: true,
              farm: { select: { name: true } },
              seller: {
                select: {
                  fullName: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          transaction: { select: { id: true } }
        }
      })
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

  const purchaseRows: Array<{ amount: number; at: Date; currency: string }> =
    [];
  for (const tx of escrowClosed) {
    if (!tx.closedAt) continue;
    purchaseRows.push({
      amount: decimalToNumber(tx.finalAmount ?? tx.blockedAmount),
      at: tx.closedAt,
      currency: tx.currency || "XOF"
    });
  }
  for (const order of shopCompleted) {
    if (!order.completedAt) continue;
    purchaseRows.push({
      amount: decimalToNumber(order.totalAmount),
      at: order.completedAt,
      currency: order.product?.currency || "XOF"
    });
  }

  const currency =
    purchaseRows.find((r) => r.currency)?.currency ??
    creditRows[0]?.listing.currency ??
    "XOF";

  const purchases: BuyerDashboardPurchasesDto = {
    currency,
    month: emptyPeriodTotals(),
    quarter: emptyPeriodTotals(),
    year: emptyPeriodTotals()
  };
  for (const key of Object.keys(pairs) as BuyerDashboardPeriodKey[]) {
    const pair = pairs[key];
    const cur = sumInWindow(
      purchaseRows,
      pair.current.start,
      pair.current.end
    );
    const prev = sumInWindow(
      purchaseRows,
      pair.previous.start,
      pair.previous.end
    );
    purchases[key] = buildPeriodTotals(
      cur.total,
      prev.total,
      cur.count,
      prev.count
    );
  }

  const items: BuyerDashboardCreditDueItemDto[] = creditRows.map((offer) => {
    const dueAt = offer.balanceDueAt;
    const overdue =
      dueAt != null &&
      dueAt.getTime() < now.getTime() &&
      (offer.status === OfferStatus.balance_pending ||
        offer.status === OfferStatus.arbitration);
    return {
      offerId: offer.id,
      transactionId: offer.transaction?.id ?? null,
      sellerName: displaySellerName(offer.listing.seller),
      farmName: offer.listing.farm?.name?.trim() || null,
      listingTitle: offer.listing.title,
      amountDue: decimalToNumber(offer.balanceAmount),
      balanceDueAt: dueAt?.toISOString() ?? null,
      overdue,
      status: offer.status,
      currency: offer.listing.currency || "XOF"
    };
  });

  const totalDue = items.reduce((sum, it) => sum + it.amountDue, 0);

  return {
    proposals,
    purchases,
    creditDues: {
      totalDue,
      currency: items[0]?.currency ?? currency,
      items
    }
  };
}

/** Export pour tests unitaires. */
export const buyerDashboardExtrasTestUtils = {
  PROPOSAL_STATUSES,
  CREDIT_DUE_STATUSES
};

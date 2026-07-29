import { OfferStatus, OfferType } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { decimalToNumber } from "./buyer-dashboard.aggregations";

export const BUYER_OPEN_CREDIT_STATUSES: OfferStatus[] = [
  OfferStatus.balance_pending,
  OfferStatus.balance_declared,
  OfferStatus.arbitration
];

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

export type BuyerCreditFinanceStatus = "current" | "overdue" | "settled";

export type BuyerCreditSituationItemDto = {
  offerId: string;
  transactionId: string | null;
  sellerName: string;
  farmName: string | null;
  listingTitle: string;
  initialAmount: number;
  advanceAmount: number;
  amountDue: number;
  balanceDueAt: string | null;
  overdue: boolean;
  financeStatus: BuyerCreditFinanceStatus;
  status: string;
  currency: string;
};

export type BuyerCreditSituationDto = {
  totalDue: number;
  currency: string;
  /** Dettes ouvertes — identique au bloc dashboard `creditDues`. */
  open: BuyerDashboardCreditDuesDto;
  /** Ouverts + soldés pour l'onglet Crédits. */
  items: BuyerCreditSituationItemDto[];
};

type CreditOfferRow = {
  id: string;
  status: OfferStatus;
  offeredPrice: { toNumber(): number } | number;
  advanceAmount: { toNumber(): number } | number | null;
  balanceAmount: { toNumber(): number } | number | null;
  balanceDueAt: Date | null;
  listing: {
    title: string;
    currency: string;
    farm: { name: string } | null;
    seller: {
      fullName: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  };
  transaction: {
    id: string;
    finalAmount: { toNumber(): number } | number | null;
    blockedAmount: { toNumber(): number } | number;
  } | null;
};

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

const creditInclude = {
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
  transaction: {
    select: { id: true, finalAmount: true, blockedAmount: true }
  }
} as const;

function isOverdue(offer: CreditOfferRow, now: Date): boolean {
  const dueAt = offer.balanceDueAt;
  return (
    dueAt != null &&
    dueAt.getTime() < now.getTime() &&
    (offer.status === OfferStatus.balance_pending ||
      offer.status === OfferStatus.arbitration)
  );
}

function financeStatusOf(
  status: OfferStatus,
  overdue: boolean
): BuyerCreditFinanceStatus {
  if (status === OfferStatus.completed) return "settled";
  if (overdue) return "overdue";
  return "current";
}

function toOpenItem(
  offer: CreditOfferRow,
  now: Date
): BuyerDashboardCreditDueItemDto {
  const overdue = isOverdue(offer, now);
  return {
    offerId: offer.id,
    transactionId: offer.transaction?.id ?? null,
    sellerName: displaySellerName(offer.listing.seller),
    farmName: offer.listing.farm?.name?.trim() || null,
    listingTitle: offer.listing.title,
    amountDue: decimalToNumber(offer.balanceAmount),
    balanceDueAt: offer.balanceDueAt?.toISOString() ?? null,
    overdue,
    status: offer.status,
    currency: offer.listing.currency || "XOF"
  };
}

function toSituationItem(
  offer: CreditOfferRow,
  now: Date
): BuyerCreditSituationItemDto {
  const overdue = isOverdue(offer, now);
  const initialAmount =
    decimalToNumber(offer.transaction?.finalAmount) ||
    decimalToNumber(offer.offeredPrice);
  const advanceAmount =
    decimalToNumber(offer.advanceAmount) ||
    decimalToNumber(offer.transaction?.blockedAmount);
  const amountDue =
    offer.status === OfferStatus.completed
      ? 0
      : decimalToNumber(offer.balanceAmount);
  return {
    offerId: offer.id,
    transactionId: offer.transaction?.id ?? null,
    sellerName: displaySellerName(offer.listing.seller),
    farmName: offer.listing.farm?.name?.trim() || null,
    listingTitle: offer.listing.title,
    initialAmount,
    advanceAmount,
    amountDue,
    balanceDueAt: offer.balanceDueAt?.toISOString() ?? null,
    overdue,
    financeStatus: financeStatusOf(offer.status, overdue),
    status: offer.status,
    currency: offer.listing.currency || "XOF"
  };
}

/**
 * Dettes crédit ouvertes — source unique dashboard ↔ finance.
 */
export async function loadBuyerOpenCreditDues(
  prisma: PrismaService,
  buyerUserId: string,
  now = new Date()
): Promise<BuyerDashboardCreditDuesDto> {
  const creditRows = (await prisma.marketplaceOffer.findMany({
    where: {
      buyerUserId,
      offerType: OfferType.credit,
      status: { in: BUYER_OPEN_CREDIT_STATUSES },
      balanceAmount: { gt: 0 }
    },
    orderBy: [{ balanceDueAt: "asc" }, { updatedAt: "desc" }],
    include: creditInclude
  })) as CreditOfferRow[];

  const items = creditRows.map((offer) => toOpenItem(offer, now));
  const totalDue = items.reduce((sum, it) => sum + it.amountDue, 0);
  return {
    totalDue,
    currency: items[0]?.currency ?? "XOF",
    items
  };
}

/**
 * Situation crédit (ouverts + soldés). `open` = même agrégat que le dashboard.
 */
export async function loadBuyerCreditSituation(
  prisma: PrismaService,
  buyerUserId: string,
  now = new Date()
): Promise<BuyerCreditSituationDto> {
  const [openRowsRaw, settledRowsRaw] = await Promise.all([
    prisma.marketplaceOffer.findMany({
      where: {
        buyerUserId,
        offerType: OfferType.credit,
        status: { in: BUYER_OPEN_CREDIT_STATUSES },
        balanceAmount: { gt: 0 }
      },
      orderBy: [{ balanceDueAt: "asc" }, { updatedAt: "desc" }],
      include: creditInclude
    }),
    prisma.marketplaceOffer.findMany({
      where: {
        buyerUserId,
        offerType: OfferType.credit,
        status: OfferStatus.completed
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: creditInclude
    })
  ]);
  const openRows = openRowsRaw as CreditOfferRow[];
  const settledRows = settledRowsRaw as CreditOfferRow[];

  const openItems = openRows.map((o) => toOpenItem(o, now));
  const open: BuyerDashboardCreditDuesDto = {
    totalDue: openItems.reduce((sum, it) => sum + it.amountDue, 0),
    currency: openItems[0]?.currency ?? "XOF",
    items: openItems
  };

  const items = [
    ...openRows.map((o) => toSituationItem(o, now)),
    ...settledRows.map((o) => toSituationItem(o, now))
  ];

  return {
    totalDue: open.totalDue,
    currency: open.currency,
    open,
    items
  };
}

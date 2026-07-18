import { BadRequestException, Injectable } from "@nestjs/common";
import {
  MarketplaceTransactionStatus,
  MerchantOrderStatus,
  OfferStatus,
  type User
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  escrowDeadlineAt,
  escrowTimeoutOutcomeKey,
  shopDeadlineAt,
  shopTimeoutOutcomeKey
} from "../../common/deadline-outcome";
import {
  deriveActionRequired,
  deriveShopActionRequired,
  type OrderViewerRole
} from "./order-action-required";
import {
  isEscrowDisputed,
  isShopDisputed,
  stageIndexOf,
  stageOfEscrow,
  stageOfShop
} from "./order-stage";
import {
  type OrderListSegment,
  type OrderProjectionCard,
  type OrdersCountersResponse,
  type OrdersListResponse
} from "./order-projection.types";

type CursorPayload = {
  updatedAt: string;
  id: string;
  type: "escrow" | "shop";
};

function displayNameOf(user: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
} | null): string {
  if (!user) return "Utilisateur";
  const full = user.fullName?.trim();
  if (full) return full;
  const parts = [user.firstName, user.lastName]
    .map((p) => p?.trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return "Utilisateur";
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(raw: string): CursorPayload {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    ) as CursorPayload;
    if (
      typeof parsed?.updatedAt !== "string" ||
      typeof parsed?.id !== "string" ||
      (parsed.type !== "escrow" && parsed.type !== "shop")
    ) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new BadRequestException("Curseur de pagination invalide");
  }
}

function matchesSegment(
  card: OrderProjectionCard,
  segment: OrderListSegment,
  role: OrderViewerRole
): boolean {
  switch (segment) {
    case "action_required":
      return card.actionRequiredBy === role;
    case "active":
      return card.stage !== "closed" && card.stage !== "cancelled";
    case "closed":
      return card.stage === "closed" || card.stage === "cancelled";
    case "disputed":
      return card.disputed;
    default:
      return false;
  }
}

function compareCards(
  a: OrderProjectionCard,
  b: OrderProjectionCard,
  segment: OrderListSegment
): number {
  if (segment === "action_required") {
    const aDl = a.deadlineAt ? Date.parse(a.deadlineAt) : Number.POSITIVE_INFINITY;
    const bDl = b.deadlineAt ? Date.parse(b.deadlineAt) : Number.POSITIVE_INFINITY;
    if (aDl !== bDl) return aDl - bDl;
    const updated = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    if (updated !== 0) return updated;
    return a.id.localeCompare(b.id);
  }
  const updated = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  if (updated !== 0) return updated;
  return a.id.localeCompare(b.id);
}

function indexAfterCursor(
  sorted: OrderProjectionCard[],
  cursor: CursorPayload
): number {
  const idx = sorted.findIndex(
    (c) => c.id === cursor.id && c.type === cursor.type
  );
  return idx >= 0 ? idx + 1 : 0;
}

@Injectable()
export class OrdersProjectionService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(
    user: User,
    params: {
      role: OrderViewerRole;
      segment: OrderListSegment;
      cursor?: string;
      limit?: number;
    }
  ): Promise<OrdersListResponse> {
    const limit = Math.min(Math.max(params.limit ?? 30, 1), 100);
    const cursor = params.cursor?.trim()
      ? decodeCursor(params.cursor.trim())
      : null;

    const cards = await this.loadCardsForRole(user.id, params.role);
    const filtered = cards
      .filter((c) => matchesSegment(c, params.segment, params.role))
      .sort((a, b) => compareCards(a, b, params.segment));

    const start = cursor ? indexAfterCursor(filtered, cursor) : 0;
    const page = filtered.slice(start, start + limit + 1);
    const hasMore = page.length > limit;
    const items = hasMore ? page.slice(0, limit) : page;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              updatedAt: last.updatedAt,
              id: last.id,
              type: last.type
            })
          : null
    };
  }

  async counters(
    user: User,
    role: OrderViewerRole
  ): Promise<OrdersCountersResponse> {
    const cards = await this.loadCardsForRole(user.id, role);
    const pendingProposals = await this.pendingProposalsCount(user.id, role);

    return {
      actionRequired: cards.filter((c) => c.actionRequiredBy === role).length,
      active: cards.filter(
        (c) => c.stage !== "closed" && c.stage !== "cancelled"
      ).length,
      disputed: cards.filter((c) => c.disputed).length,
      pendingProposals
    };
  }

  /** Compteur propositions : même source que GET /marketplace/offers/counts. */
  private async pendingProposalsCount(
    userId: string,
    role: OrderViewerRole
  ): Promise<number> {
    if (role === "seller") {
      return this.prisma.marketplaceOffer.count({
        where: {
          status: OfferStatus.pending,
          listing: { sellerUserId: userId }
        }
      });
    }
    return this.prisma.marketplaceOffer.count({
      where: {
        buyerUserId: userId,
        status: { in: [OfferStatus.pending, OfferStatus.countered] }
      }
    });
  }

  private async loadCardsForRole(
    userId: string,
    role: OrderViewerRole
  ): Promise<OrderProjectionCard[]> {
    const escrowWhere =
      role === "buyer"
        ? { buyerUserId: userId }
        : { sellerUserId: userId };
    const shopWhere =
      role === "buyer"
        ? { buyerUserId: userId }
        : { sellerUserId: userId };

    const [escrowRows, shopRows] = await Promise.all([
      this.prisma.marketplaceTransaction.findMany({
        where: escrowWhere,
        orderBy: { updatedAt: "desc" },
        take: 200,
        include: {
          listing: { select: { title: true } },
          buyer: {
            select: { fullName: true, firstName: true, lastName: true }
          },
          seller: {
            select: { fullName: true, firstName: true, lastName: true }
          }
        }
      }),
      this.prisma.merchantOrder.findMany({
        where: shopWhere,
        orderBy: { updatedAt: "desc" },
        take: 200,
        include: {
          product: { select: { name: true, currency: true } },
          buyer: {
            select: { fullName: true, firstName: true, lastName: true }
          },
          seller: {
            select: { fullName: true, firstName: true, lastName: true }
          }
        }
      })
    ]);

    const escrowCards = escrowRows.map((tx) =>
      this.mapEscrowCard(tx, role)
    );
    const shopCards = shopRows.map((order) =>
      this.mapShopCard(order, role)
    );
    return [...escrowCards, ...shopCards];
  }

  private mapEscrowCard(
    tx: {
      id: string;
      status: MarketplaceTransactionStatus;
      blockedAmount: { toNumber(): number } | number;
      finalAmount: { toNumber(): number } | number | null;
      currency: string;
      offerExpiresAt: Date;
      weightDeclaredByBuyerAt: Date | null;
      sellerShippedAt: Date | null;
      updatedAt: Date;
      listing: { title: string } | null;
      buyer: {
        fullName: string | null;
        firstName: string | null;
        lastName: string | null;
      };
      seller: {
        fullName: string | null;
        firstName: string | null;
        lastName: string | null;
      };
    },
    role: OrderViewerRole
  ): OrderProjectionCard {
    const stage = stageOfEscrow(tx.status);
    const action = deriveActionRequired(tx.status, role);
    const amountRaw = tx.finalAmount ?? tx.blockedAmount;
    const amount =
      typeof amountRaw === "number" ? amountRaw : amountRaw.toNumber();
    const deadline = escrowDeadlineAt(tx);
    const counterparty = role === "buyer" ? tx.seller : tx.buyer;

    return {
      id: tx.id,
      type: "escrow",
      reference: tx.id,
      status: tx.status,
      stage,
      stageIndex: stageIndexOf(stage),
      disputed: isEscrowDisputed(tx.status),
      actionRequiredBy: action.actionRequiredBy,
      nextActionKey: action.nextActionKey,
      deadlineAt: deadline?.toISOString() ?? null,
      timeoutOutcomeKey: deadline
        ? escrowTimeoutOutcomeKey(tx.status)
        : null,
      counterparty: { displayName: displayNameOf(counterparty) },
      itemSummary: tx.listing?.title?.trim() || "Commande marketplace",
      amount,
      currency: tx.currency || "XOF",
      updatedAt: tx.updatedAt.toISOString()
    };
  }

  private mapShopCard(
    order: {
      id: string;
      status: MerchantOrderStatus;
      totalAmount: { toNumber(): number } | number;
      timeoutAt: Date | null;
      deliveredAt: Date | null;
      updatedAt: Date;
      product: { name: string; currency: string } | null;
      buyer: {
        fullName: string | null;
        firstName: string | null;
        lastName: string | null;
      };
      seller: {
        fullName: string | null;
        firstName: string | null;
        lastName: string | null;
      };
    },
    role: OrderViewerRole
  ): OrderProjectionCard {
    const stage = stageOfShop(order.status);
    const action = deriveShopActionRequired(order.status, role);
    const amount =
      typeof order.totalAmount === "number"
        ? order.totalAmount
        : order.totalAmount.toNumber();
    const deadline = shopDeadlineAt(order);
    const counterparty = role === "buyer" ? order.seller : order.buyer;

    return {
      id: order.id,
      type: "shop",
      reference: order.id,
      status: order.status,
      stage,
      stageIndex: stageIndexOf(stage),
      disputed: isShopDisputed(order.status),
      actionRequiredBy: action.actionRequiredBy,
      nextActionKey: action.nextActionKey,
      deadlineAt: deadline?.toISOString() ?? null,
      timeoutOutcomeKey: deadline
        ? shopTimeoutOutcomeKey(order.status)
        : null,
      counterparty: { displayName: displayNameOf(counterparty) },
      itemSummary: order.product?.name?.trim() || "Commande boutique",
      amount,
      currency: order.product?.currency || "XOF",
      updatedAt: order.updatedAt.toISOString()
    };
  }
}

/** Helpers exportés pour les tests unitaires de segment / tri. */
export const ordersProjectionTestUtils = {
  matchesSegment,
  compareCards,
  encodeCursor,
  decodeCursor,
  escrowDeadlineAt,
  shopDeadlineAt
};

import {
  MarketplaceTransactionStatus,
  MerchantOrderStatus,
  OfferStatus
} from "@prisma/client";
import {
  OrdersProjectionService,
  ordersProjectionTestUtils
} from "./orders-projection.service";
import type { OrderProjectionCard } from "./order-projection.types";

function card(
  partial: Partial<OrderProjectionCard> & Pick<OrderProjectionCard, "id">
): OrderProjectionCard {
  return {
    type: "escrow",
    reference: partial.id,
    status: MarketplaceTransactionStatus.PAYMENT_PENDING,
    stage: "payment",
    stageIndex: 1,
    disputed: false,
    actionRequiredBy: "buyer",
    nextActionKey: "orders.action.pay",
    deadlineAt: null,
    timeoutOutcomeKey: null,
    counterparty: { displayName: "X" },
    itemSummary: "Item",
    amount: 1000,
    currency: "XOF",
    updatedAt: "2026-07-17T12:00:00.000Z",
    ...partial
  };
}

describe("ordersProjectionTestUtils — segments", () => {
  const { matchesSegment } = ordersProjectionTestUtils;

  it("action_required = actionRequiredBy === role", () => {
    const buyerAction = card({
      id: "1",
      actionRequiredBy: "buyer"
    });
    const sellerAction = card({
      id: "2",
      actionRequiredBy: "seller",
      stage: "delivery",
      stageIndex: 2
    });
    expect(matchesSegment(buyerAction, "action_required", "buyer")).toBe(true);
    expect(matchesSegment(buyerAction, "action_required", "seller")).toBe(
      false
    );
    expect(matchesSegment(sellerAction, "action_required", "seller")).toBe(
      true
    );
  });

  it("active exclut closed/cancelled", () => {
    expect(
      matchesSegment(
        card({ id: "a", stage: "delivery", stageIndex: 2 }),
        "active",
        "buyer"
      )
    ).toBe(true);
    expect(
      matchesSegment(
        card({ id: "b", stage: "closed", stageIndex: 4 }),
        "active",
        "buyer"
      )
    ).toBe(false);
    expect(
      matchesSegment(
        card({ id: "c", stage: "cancelled", stageIndex: -1 }),
        "active",
        "buyer"
      )
    ).toBe(false);
  });

  it("closed inclut closes et annulations", () => {
    expect(
      matchesSegment(
        card({ id: "d", stage: "closed", stageIndex: 4 }),
        "closed",
        "buyer"
      )
    ).toBe(true);
    expect(
      matchesSegment(
        card({ id: "e", stage: "cancelled", stageIndex: -1 }),
        "closed",
        "buyer"
      )
    ).toBe(true);
    expect(
      matchesSegment(
        card({ id: "f", stage: "payment", stageIndex: 1 }),
        "closed",
        "buyer"
      )
    ).toBe(false);
  });

  it("disputed = flag disputed", () => {
    expect(
      matchesSegment(card({ id: "g", disputed: true }), "disputed", "buyer")
    ).toBe(true);
    expect(
      matchesSegment(card({ id: "h", disputed: false }), "disputed", "buyer")
    ).toBe(false);
  });
});

describe("ordersProjectionTestUtils — tri échéance", () => {
  const { compareCards } = ordersProjectionTestUtils;

  it("action_required : deadlineAt croissant puis updatedAt", () => {
    const early = card({
      id: "early",
      deadlineAt: "2026-07-18T10:00:00.000Z",
      updatedAt: "2026-07-17T08:00:00.000Z"
    });
    const late = card({
      id: "late",
      deadlineAt: "2026-07-19T10:00:00.000Z",
      updatedAt: "2026-07-17T20:00:00.000Z"
    });
    const noDeadline = card({
      id: "none",
      deadlineAt: null,
      updatedAt: "2026-07-17T22:00:00.000Z"
    });
    const sorted = [late, noDeadline, early].sort((a, b) =>
      compareCards(a, b, "action_required")
    );
    expect(sorted.map((c) => c.id)).toEqual(["early", "late", "none"]);
  });

  it("autres segments : updatedAt desc", () => {
    const older = card({
      id: "old",
      updatedAt: "2026-07-16T00:00:00.000Z"
    });
    const newer = card({
      id: "new",
      updatedAt: "2026-07-17T00:00:00.000Z"
    });
    const sorted = [older, newer].sort((a, b) =>
      compareCards(a, b, "active")
    );
    expect(sorted.map((c) => c.id)).toEqual(["new", "old"]);
  });
});

describe("OrdersProjectionService — isolation + agrégation", () => {
  const prisma = {
    marketplaceTransaction: { findMany: jest.fn() },
    merchantOrder: { findMany: jest.fn() },
    marketplaceOffer: { count: jest.fn() }
  };

  let service: OrdersProjectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersProjectionService(prisma as never);
  });

  it("n’interroge que les transactions où l’utilisateur est partie (buyer)", async () => {
    prisma.marketplaceTransaction.findMany.mockResolvedValue([]);
    prisma.merchantOrder.findMany.mockResolvedValue([]);

    await service.listOrders(
      { id: "user-buyer" } as never,
      { role: "buyer", segment: "active" }
    );

    expect(prisma.marketplaceTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { buyerUserId: "user-buyer" }
      })
    );
    expect(prisma.merchantOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { buyerUserId: "user-buyer" }
      })
    );
  });

  it("n’interroge que les transactions où l’utilisateur est partie (seller)", async () => {
    prisma.marketplaceTransaction.findMany.mockResolvedValue([]);
    prisma.merchantOrder.findMany.mockResolvedValue([]);

    await service.listOrders(
      { id: "user-seller" } as never,
      { role: "seller", segment: "active" }
    );

    expect(prisma.marketplaceTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sellerUserId: "user-seller" }
      })
    );
    expect(prisma.merchantOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sellerUserId: "user-seller" }
      })
    );
  });

  it("agrège escrow + shop et filtre action_required", async () => {
    prisma.marketplaceTransaction.findMany.mockResolvedValue([
      {
        id: "tx-1",
        status: MarketplaceTransactionStatus.PAYMENT_PENDING,
        blockedAmount: { toNumber: () => 5000 },
        finalAmount: null,
        currency: "XOF",
        offerExpiresAt: new Date("2026-07-19T00:00:00.000Z"),
        weightDeclaredByBuyerAt: null,
        sellerShippedAt: null,
        updatedAt: new Date("2026-07-17T10:00:00.000Z"),
        listing: { title: "Porcelets" },
        buyer: { fullName: "Acheteur", firstName: null, lastName: null },
        seller: { fullName: "Vendeur", firstName: null, lastName: null }
      },
      {
        id: "tx-2",
        status: MarketplaceTransactionStatus.PICKUP_PROPOSED,
        blockedAmount: { toNumber: () => 8000 },
        finalAmount: null,
        currency: "XOF",
        offerExpiresAt: new Date("2026-07-20T00:00:00.000Z"),
        weightDeclaredByBuyerAt: null,
        sellerShippedAt: null,
        updatedAt: new Date("2026-07-17T11:00:00.000Z"),
        listing: { title: "Truie" },
        buyer: { fullName: "Acheteur", firstName: null, lastName: null },
        seller: { fullName: "Vendeur", firstName: null, lastName: null }
      }
    ]);
    prisma.merchantOrder.findMany.mockResolvedValue([
      {
        id: "mo-1",
        status: MerchantOrderStatus.delivered,
        totalAmount: { toNumber: () => 2000 },
        timeoutAt: null,
        deliveredAt: new Date("2026-07-16T00:00:00.000Z"),
        updatedAt: new Date("2026-07-17T09:00:00.000Z"),
        product: { name: "Aliment", currency: "XOF" },
        buyer: { fullName: "Acheteur", firstName: null, lastName: null },
        seller: { fullName: "Boutique", firstName: null, lastName: null }
      }
    ]);

    const result = await service.listOrders(
      { id: "user-buyer" } as never,
      { role: "buyer", segment: "action_required" }
    );

    // PAYMENT_PENDING (buyer) + delivered shop (buyer) ; PICKUP_PROPOSED = seller
    expect(result.items.map((i) => i.id).sort()).toEqual(["mo-1", "tx-1"]);
    expect(result.items.every((i) => i.actionRequiredBy === "buyer")).toBe(
      true
    );
    expect(result.items.find((i) => i.id === "mo-1")?.type).toBe("shop");
    expect(result.items.find((i) => i.id === "tx-1")?.type).toBe("escrow");
  });

  it("counters : pendingProposals selon le rôle (source offres)", async () => {
    prisma.marketplaceTransaction.findMany.mockResolvedValue([]);
    prisma.merchantOrder.findMany.mockResolvedValue([]);
    prisma.marketplaceOffer.count.mockResolvedValue(3);

    const asBuyer = await service.counters({ id: "u1" } as never, "buyer");
    expect(prisma.marketplaceOffer.count).toHaveBeenCalledWith({
      where: {
        buyerUserId: "u1",
        status: { in: [OfferStatus.pending, OfferStatus.countered] }
      }
    });
    expect(asBuyer.pendingProposals).toBe(3);

    prisma.marketplaceOffer.count.mockResolvedValue(5);
    const asSeller = await service.counters({ id: "u1" } as never, "seller");
    expect(prisma.marketplaceOffer.count).toHaveBeenCalledWith({
      where: {
        status: OfferStatus.pending,
        listing: { sellerUserId: "u1" }
      }
    });
    expect(asSeller.pendingProposals).toBe(5);
  });
});

import {
  isActionRequiredByViewer,
  legacyBuyerHistoryTabToSegment,
  orderDetailRoute,
  orderStatusLabelKey,
  orderStatusTone,
  orderTypeLabelKey,
  ordersHubSegmentToQuery,
  mapOrderProjectionToCardProps
} from "../ordersHub";
import type { MarketplaceOrderProjectionCard } from "../api/marketplaceOrders";

function card(
  partial: Partial<MarketplaceOrderProjectionCard> &
    Pick<MarketplaceOrderProjectionCard, "id" | "type" | "status">
): MarketplaceOrderProjectionCard {
  return {
    reference: partial.id,
    stage: "payment",
    stageIndex: 1,
    disputed: false,
    actionRequiredBy: "buyer",
    nextActionKey: "orders.action.pay",
    deadlineAt: null,
    timeoutOutcomeKey: null,
    counterparty: { displayName: "Contrepartie" },
    itemSummary: "Article",
    amount: 1000,
    currency: "XOF",
    updatedAt: "2026-07-17T12:00:00.000Z",
    ...partial
  };
}

describe("ordersHubSegmentToQuery", () => {
  it.each([
    "action_required",
    "active",
    "disputed",
    "closed"
  ] as const)("mappe %s → même segment API", (segment) => {
    expect(ordersHubSegmentToQuery(segment)).toBe(segment);
  });
});

describe("orderDetailRoute", () => {
  it("route escrow → MarketplaceTransaction", () => {
    expect(orderDetailRoute({ id: "tx-1", type: "escrow" })).toEqual({
      screen: "MarketplaceTransaction",
      params: { transactionId: "tx-1" }
    });
  });

  it("route shop → MerchantOrderDetail", () => {
    expect(orderDetailRoute({ id: "mo-1", type: "shop" })).toEqual({
      screen: "MerchantOrderDetail",
      params: { orderId: "mo-1" }
    });
  });
});

describe("orderTypeLabelKey / status", () => {
  it("étiquette type escrow vs boutique", () => {
    expect(orderTypeLabelKey("escrow")).toBe("orders.hub.type.escrow");
    expect(orderTypeLabelKey("shop")).toBe("orders.hub.type.shop");
  });

  it("statut boutique paid → clé acheteur", () => {
    expect(
      orderStatusLabelKey({ type: "shop", status: "paid" })
    ).toBe("merchant.orders.status.paidBuyer");
  });

  it("statut escrow → clé hub", () => {
    expect(
      orderStatusLabelKey({ type: "escrow", status: "PAYMENT_PENDING" })
    ).toBe("orders.hub.escrowStatus.PAYMENT_PENDING");
  });
});

describe("orderStatusTone / actionRequired", () => {
  it("disputé → danger", () => {
    expect(
      orderStatusTone(
        card({ id: "1", type: "escrow", status: "WEIGHT_DISPUTED", disputed: true })
      )
    ).toBe("danger");
  });

  it("actionRequiredByMe selon le rôle", () => {
    const row = card({
      id: "1",
      type: "escrow",
      status: "PAYMENT_PENDING",
      actionRequiredBy: "buyer"
    });
    expect(isActionRequiredByViewer(row, "buyer")).toBe(true);
    expect(isActionRequiredByViewer(row, "seller")).toBe(false);
  });
});

describe("legacyBuyerHistoryTabToSegment", () => {
  it("mappe les anciens onglets", () => {
    expect(legacyBuyerHistoryTabToSegment("proposals")).toBe("action_required");
    expect(legacyBuyerHistoryTabToSegment("purchases")).toBe("active");
    expect(legacyBuyerHistoryTabToSegment("shopOrders")).toBe("active");
    expect(legacyBuyerHistoryTabToSegment("reviews")).toBe("closed");
    expect(legacyBuyerHistoryTabToSegment(undefined)).toBe("action_required");
  });
});

describe("mapOrderProjectionToCardProps", () => {
  it("projette les props OrderCard + compteur propositions côté mapping", () => {
    const props = mapOrderProjectionToCardProps(
      card({
        id: "tx-9",
        type: "escrow",
        status: "PAYMENT_PENDING",
        actionRequiredBy: "buyer",
        nextActionKey: "orders.action.pay",
        amount: 4500,
        counterparty: { displayName: "Vendeur" }
      }),
      "buyer"
    );
    expect(props).toMatchObject({
      reference: "tx-9",
      counterparty: "Vendeur",
      amount: 4500,
      typeLabelKey: "orders.hub.type.escrow",
      actionRequiredByMe: true,
      nextActionKey: "orders.action.pay"
    });
  });
});

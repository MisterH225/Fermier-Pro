import {
  MarketplaceTransactionStatus,
  MerchantOrderStatus
} from "@prisma/client";
import {
  isEscrowDisputed,
  isShopDisputed,
  ORDER_STAGE_INDEX,
  stageIndexOf,
  stageOfEscrow,
  stageOfShop
} from "./order-stage";

describe("stageOfEscrow", () => {
  const expected: Record<MarketplaceTransactionStatus, string> = {
    [MarketplaceTransactionStatus.OFFER_ACCEPTED]: "order",
    [MarketplaceTransactionStatus.PAYMENT_PENDING]: "payment",
    [MarketplaceTransactionStatus.PAYMENT_FAILED]: "payment",
    [MarketplaceTransactionStatus.PAYMENT_HELD]: "delivery",
    [MarketplaceTransactionStatus.PICKUP_PROPOSED]: "delivery",
    [MarketplaceTransactionStatus.PICKUP_SCHEDULED]: "delivery",
    [MarketplaceTransactionStatus.SELLER_SHIPPED]: "delivery",
    [MarketplaceTransactionStatus.DELIVERY_DISPUTED]: "delivery",
    [MarketplaceTransactionStatus.WEIGHT_DECLARED]: "receipt_weighing",
    [MarketplaceTransactionStatus.WEIGHT_COUNTER_DECLARED]: "receipt_weighing",
    [MarketplaceTransactionStatus.WEIGHT_DISPUTED]: "receipt_weighing",
    [MarketplaceTransactionStatus.WEIGHT_VALIDATED]: "receipt_weighing",
    [MarketplaceTransactionStatus.BUYER_RECEIVED]: "receipt_weighing",
    [MarketplaceTransactionStatus.TRANSACTION_CLOSED]: "closed",
    [MarketplaceTransactionStatus.CANCELLED_BY_BUYER]: "cancelled",
    [MarketplaceTransactionStatus.CANCELLED_BY_SELLER]: "cancelled",
    [MarketplaceTransactionStatus.CANCELLED_SOLD_TO_OTHER]: "cancelled",
    [MarketplaceTransactionStatus.OFFER_EXPIRED]: "cancelled"
  };

  it.each(Object.values(MarketplaceTransactionStatus))(
    "mappe %s",
    (status) => {
      expect(stageOfEscrow(status)).toBe(expected[status]);
      expect(stageIndexOf(stageOfEscrow(status))).toBe(
        ORDER_STAGE_INDEX[stageOfEscrow(status)]
      );
    }
  );

  it("DELIVERY_DISPUTED et WEIGHT_DISPUTED restent dans leur macro-étape + disputed", () => {
    expect(stageOfEscrow(MarketplaceTransactionStatus.DELIVERY_DISPUTED)).toBe(
      "delivery"
    );
    expect(isEscrowDisputed(MarketplaceTransactionStatus.DELIVERY_DISPUTED)).toBe(
      true
    );
    expect(stageOfEscrow(MarketplaceTransactionStatus.WEIGHT_DISPUTED)).toBe(
      "receipt_weighing"
    );
    expect(isEscrowDisputed(MarketplaceTransactionStatus.WEIGHT_DISPUTED)).toBe(
      true
    );
  });
});

describe("stageOfShop", () => {
  it.each(Object.values(MerchantOrderStatus))("mappe %s", (status) => {
    const stage = stageOfShop(status);
    expect(stage).toBeTruthy();
    expect(typeof stageIndexOf(stage)).toBe("number");
  });

  it("disputed boutique → delivery + flag", () => {
    expect(stageOfShop(MerchantOrderStatus.disputed)).toBe("delivery");
    expect(isShopDisputed(MerchantOrderStatus.disputed)).toBe(true);
  });
});

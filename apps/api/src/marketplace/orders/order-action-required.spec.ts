import { MarketplaceTransactionStatus } from "@prisma/client";
import {
  deriveActionRequired,
  deriveShopActionRequired
} from "./order-action-required";
import { MerchantOrderStatus } from "@prisma/client";

const ALL_ESCROW = Object.values(MarketplaceTransactionStatus);
const ROLES = ["buyer", "seller"] as const;

/** Snapshot attendu : qui doit agir + clé i18n (absolu, indépendant du viewer). */
const EXPECTED_ESCROW: Record<
  MarketplaceTransactionStatus,
  { actionRequiredBy: string; nextActionKey: string | null }
> = {
  [MarketplaceTransactionStatus.OFFER_ACCEPTED]: {
    actionRequiredBy: "none",
    nextActionKey: null
  },
  [MarketplaceTransactionStatus.PAYMENT_PENDING]: {
    actionRequiredBy: "buyer",
    nextActionKey: "orders.action.pay"
  },
  [MarketplaceTransactionStatus.PAYMENT_FAILED]: {
    actionRequiredBy: "buyer",
    nextActionKey: "orders.action.retryPayment"
  },
  [MarketplaceTransactionStatus.PAYMENT_HELD]: {
    actionRequiredBy: "buyer",
    nextActionKey: "orders.action.proposePickup"
  },
  [MarketplaceTransactionStatus.PICKUP_PROPOSED]: {
    actionRequiredBy: "seller",
    nextActionKey: "orders.action.confirmPickup"
  },
  [MarketplaceTransactionStatus.PICKUP_SCHEDULED]: {
    actionRequiredBy: "buyer",
    nextActionKey: "orders.action.declareWeight"
  },
  [MarketplaceTransactionStatus.WEIGHT_DECLARED]: {
    actionRequiredBy: "seller",
    nextActionKey: "orders.action.validateWeight"
  },
  [MarketplaceTransactionStatus.WEIGHT_COUNTER_DECLARED]: {
    actionRequiredBy: "seller",
    nextActionKey: "orders.action.validateWeight"
  },
  [MarketplaceTransactionStatus.WEIGHT_DISPUTED]: {
    actionRequiredBy: "system",
    nextActionKey: null
  },
  [MarketplaceTransactionStatus.WEIGHT_VALIDATED]: {
    actionRequiredBy: "seller",
    nextActionKey: "orders.action.confirmShipment"
  },
  [MarketplaceTransactionStatus.SELLER_SHIPPED]: {
    actionRequiredBy: "buyer",
    nextActionKey: "orders.action.confirmReceipt"
  },
  [MarketplaceTransactionStatus.BUYER_RECEIVED]: {
    actionRequiredBy: "system",
    nextActionKey: null
  },
  [MarketplaceTransactionStatus.DELIVERY_DISPUTED]: {
    actionRequiredBy: "system",
    nextActionKey: null
  },
  [MarketplaceTransactionStatus.TRANSACTION_CLOSED]: {
    actionRequiredBy: "none",
    nextActionKey: null
  },
  [MarketplaceTransactionStatus.CANCELLED_BY_BUYER]: {
    actionRequiredBy: "none",
    nextActionKey: null
  },
  [MarketplaceTransactionStatus.CANCELLED_BY_SELLER]: {
    actionRequiredBy: "none",
    nextActionKey: null
  },
  [MarketplaceTransactionStatus.CANCELLED_SOLD_TO_OTHER]: {
    actionRequiredBy: "none",
    nextActionKey: null
  },
  [MarketplaceTransactionStatus.OFFER_EXPIRED]: {
    actionRequiredBy: "none",
    nextActionKey: null
  }
};

describe("deriveActionRequired", () => {
  it.each(ALL_ESCROW)(
    "snapshot exhaustif pour %s (buyer et seller identiques)",
    (status) => {
      const expected = EXPECTED_ESCROW[status];
      for (const role of ROLES) {
        expect(deriveActionRequired(status, role)).toEqual(expected);
      }
    }
  );

  it("couvre chaque statut Prisma exactement une fois dans le snapshot", () => {
    expect(Object.keys(EXPECTED_ESCROW).sort()).toEqual(
      [...ALL_ESCROW].sort()
    );
  });
});

describe("deriveShopActionRequired", () => {
  const cases: Array<{
    status: MerchantOrderStatus;
    actionRequiredBy: string;
    nextActionKey: string | null;
  }> = [
    {
      status: MerchantOrderStatus.payment_pending,
      actionRequiredBy: "buyer",
      nextActionKey: "orders.action.pay"
    },
    {
      status: MerchantOrderStatus.paid,
      actionRequiredBy: "seller",
      nextActionKey: "orders.action.confirmShopOrder"
    },
    {
      status: MerchantOrderStatus.confirmed,
      actionRequiredBy: "seller",
      nextActionKey: "orders.action.shipShopOrder"
    },
    {
      status: MerchantOrderStatus.shipping,
      actionRequiredBy: "seller",
      nextActionKey: "orders.action.markShopDelivered"
    },
    {
      status: MerchantOrderStatus.delivered,
      actionRequiredBy: "buyer",
      nextActionKey: "orders.action.confirmReceipt"
    },
    {
      status: MerchantOrderStatus.completed,
      actionRequiredBy: "none",
      nextActionKey: null
    },
    {
      status: MerchantOrderStatus.disputed,
      actionRequiredBy: "system",
      nextActionKey: null
    },
    {
      status: MerchantOrderStatus.cancelled,
      actionRequiredBy: "none",
      nextActionKey: null
    }
  ];

  it.each(cases)(
    "$status → $actionRequiredBy / $nextActionKey",
    ({ status, actionRequiredBy, nextActionKey }) => {
      expect(deriveShopActionRequired(status, "buyer")).toEqual({
        actionRequiredBy,
        nextActionKey
      });
    }
  );

  it("couvre tous les MerchantOrderStatus", () => {
    for (const status of Object.values(MerchantOrderStatus)) {
      expect(deriveShopActionRequired(status, "seller")).toBeDefined();
    }
  });
});

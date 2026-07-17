import {
  MARKETPLACE_STATUS_UI,
  MARKETPLACE_TRANSACTION_STATUSES,
  marketplaceTransactionActions
} from "../marketplaceOrderStatusUi";

describe("MARKETPLACE_STATUS_UI", () => {
  it("mappe exhaustivement les 18 statuts vers badge et macro-étape", () => {
    expect(MARKETPLACE_TRANSACTION_STATUSES).toHaveLength(18);
    expect(
      Object.fromEntries(
        MARKETPLACE_TRANSACTION_STATUSES.map((status) => {
          const ui = MARKETPLACE_STATUS_UI[status];
          return [
            status,
            {
              tone: ui.tone,
              stage: ui.stage,
              stageIndex: ui.stageIndex,
              disputedIndex: ui.disputedIndex
            }
          ];
        })
      )
    ).toEqual({
      OFFER_ACCEPTED: {
        tone: "pending",
        stage: "order",
        stageIndex: 0,
        disputedIndex: undefined
      },
      PAYMENT_PENDING: {
        tone: "pending",
        stage: "payment",
        stageIndex: 1,
        disputedIndex: undefined
      },
      PAYMENT_HELD: {
        tone: "active",
        stage: "delivery",
        stageIndex: 2,
        disputedIndex: undefined
      },
      PICKUP_PROPOSED: {
        tone: "pending",
        stage: "delivery",
        stageIndex: 2,
        disputedIndex: undefined
      },
      PICKUP_SCHEDULED: {
        tone: "active",
        stage: "delivery",
        stageIndex: 2,
        disputedIndex: undefined
      },
      SELLER_SHIPPED: {
        tone: "active",
        stage: "delivery",
        stageIndex: 2,
        disputedIndex: undefined
      },
      BUYER_RECEIVED: {
        tone: "active",
        stage: "receipt_weighing",
        stageIndex: 3,
        disputedIndex: undefined
      },
      DELIVERY_DISPUTED: {
        tone: "danger",
        stage: "delivery",
        stageIndex: 2,
        disputedIndex: 2
      },
      WEIGHT_DECLARED: {
        tone: "pending",
        stage: "receipt_weighing",
        stageIndex: 3,
        disputedIndex: undefined
      },
      WEIGHT_COUNTER_DECLARED: {
        tone: "pending",
        stage: "receipt_weighing",
        stageIndex: 3,
        disputedIndex: undefined
      },
      WEIGHT_DISPUTED: {
        tone: "danger",
        stage: "receipt_weighing",
        stageIndex: 3,
        disputedIndex: 3
      },
      WEIGHT_VALIDATED: {
        tone: "active",
        stage: "receipt_weighing",
        stageIndex: 3,
        disputedIndex: undefined
      },
      TRANSACTION_CLOSED: {
        tone: "success",
        stage: "closed",
        stageIndex: 4,
        disputedIndex: undefined
      },
      CANCELLED_BY_BUYER: {
        tone: "neutral",
        stage: "cancelled",
        stageIndex: -1,
        disputedIndex: undefined
      },
      CANCELLED_BY_SELLER: {
        tone: "neutral",
        stage: "cancelled",
        stageIndex: -1,
        disputedIndex: undefined
      },
      CANCELLED_SOLD_TO_OTHER: {
        tone: "neutral",
        stage: "cancelled",
        stageIndex: -1,
        disputedIndex: undefined
      },
      PAYMENT_FAILED: {
        tone: "danger",
        stage: "payment",
        stageIndex: 1,
        disputedIndex: undefined
      },
      OFFER_EXPIRED: {
        tone: "neutral",
        stage: "cancelled",
        stageIndex: -1,
        disputedIndex: undefined
      }
    });
  });

  it("porte une clé de libellé courte pour chaque statut", () => {
    for (const status of MARKETPLACE_TRANSACTION_STATUSES) {
      expect(MARKETPLACE_STATUS_UI[status].labelKey).toBe(
        `marketScreen.transaction.shortStatus.${status}`
      );
    }
  });
});

describe("marketplaceTransactionActions", () => {
  it("préserve les actions historiques pour chaque statut et chaque rôle", () => {
    expect(
      Object.fromEntries(
        MARKETPLACE_TRANSACTION_STATUSES.map((status) => [
          status,
          {
            buyer: marketplaceTransactionActions(status, "buyer"),
            seller: marketplaceTransactionActions(status, "seller")
          }
        ])
      )
    ).toEqual({
      OFFER_ACCEPTED: { buyer: [], seller: [] },
      PAYMENT_PENDING: {
        buyer: ["pay", "cancel"],
        seller: ["cancel"]
      },
      PAYMENT_HELD: {
        buyer: ["propose_pickup", "cancel"],
        seller: ["cancel"]
      },
      PICKUP_PROPOSED: {
        buyer: [],
        seller: ["confirm_pickup"]
      },
      PICKUP_SCHEDULED: {
        buyer: ["declare_weight", "cancel"],
        seller: ["cancel"]
      },
      SELLER_SHIPPED: {
        buyer: ["confirm_receipt", "cancel"],
        seller: ["cancel"]
      },
      BUYER_RECEIVED: { buyer: [], seller: [] },
      DELIVERY_DISPUTED: { buyer: [], seller: [] },
      WEIGHT_DECLARED: {
        buyer: [],
        seller: ["validate_weight", "counter_weight"]
      },
      WEIGHT_COUNTER_DECLARED: {
        buyer: ["request_weight_arbitration"],
        seller: ["validate_weight", "request_weight_arbitration"]
      },
      WEIGHT_DISPUTED: { buyer: [], seller: [] },
      WEIGHT_VALIDATED: {
        buyer: [],
        seller: ["confirm_shipment"]
      },
      TRANSACTION_CLOSED: {
        buyer: ["complete_transfer"],
        seller: []
      },
      CANCELLED_BY_BUYER: { buyer: [], seller: [] },
      CANCELLED_BY_SELLER: { buyer: [], seller: [] },
      CANCELLED_SOLD_TO_OTHER: { buyer: [], seller: [] },
      PAYMENT_FAILED: { buyer: ["pay"], seller: [] },
      OFFER_EXPIRED: { buyer: [], seller: [] }
    });
  });
});

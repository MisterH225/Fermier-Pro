import {
  MarketplaceTransactionStatus,
  MerchantOrderStatus,
  OfferStatus
} from "@prisma/client";
import { MERCHANT_ORDER_DISPUTE_WINDOW_MS } from "../merchant-shop/merchant-shop.constants";
import {
  WEIGHT_AUTO_VALIDATE_MS,
  DELIVERY_DISPUTE_AUTO_MS
} from "../marketplace/orders/order-projection.types";
import {
  DEADLINE_OUTCOME_KEY,
  creditBalanceTimeoutOutcomeKey,
  escrowDeadlineAt,
  escrowTimeoutOutcomeKey,
  offerProposalTimeoutOutcomeKey,
  shopDeadlineAt,
  shopTimeoutOutcomeKey
} from "./deadline-outcome";

const T0 = new Date("2026-07-18T10:00:00.000Z");

describe("deadline-outcome — échéance + conséquence par état (P-43)", () => {
  describe("escrow marketplace (porc)", () => {
    it("PAYMENT_PENDING → échéance = offerExpiresAt + conséquence sans remboursement", () => {
      const tx = {
        status: MarketplaceTransactionStatus.PAYMENT_PENDING,
        offerExpiresAt: T0,
        weightDeclaredByBuyerAt: null,
        sellerShippedAt: null
      };
      expect(escrowDeadlineAt(tx)).toEqual(T0);
      expect(escrowTimeoutOutcomeKey(tx.status)).toBe(
        DEADLINE_OUTCOME_KEY.offerPaymentExpire
      );
    });

    it("WEIGHT_DECLARED → échéance = déclaration + 24h + validation auto", () => {
      const declaredAt = new Date("2026-07-18T08:00:00.000Z");
      const tx = {
        status: MarketplaceTransactionStatus.WEIGHT_DECLARED,
        offerExpiresAt: T0,
        weightDeclaredByBuyerAt: declaredAt,
        sellerShippedAt: null
      };
      expect(escrowDeadlineAt(tx)?.getTime()).toBe(
        declaredAt.getTime() + WEIGHT_AUTO_VALIDATE_MS
      );
      expect(escrowTimeoutOutcomeKey(tx.status)).toBe(
        DEADLINE_OUTCOME_KEY.weightAutoValidate
      );
    });

    it("SELLER_SHIPPED → échéance = envoi + 14j + ouverture de problème", () => {
      const shippedAt = new Date("2026-07-01T08:00:00.000Z");
      const tx = {
        status: MarketplaceTransactionStatus.SELLER_SHIPPED,
        offerExpiresAt: T0,
        weightDeclaredByBuyerAt: null,
        sellerShippedAt: shippedAt
      };
      expect(escrowDeadlineAt(tx)?.getTime()).toBe(
        shippedAt.getTime() + DELIVERY_DISPUTE_AUTO_MS
      );
      expect(escrowTimeoutOutcomeKey(tx.status)).toBe(
        DEADLINE_OUTCOME_KEY.deliveryAutoDispute
      );
    });

    it("PAYMENT_FAILED → aucune échéance (anomalie : pas de cron)", () => {
      const tx = {
        status: MarketplaceTransactionStatus.PAYMENT_FAILED,
        offerExpiresAt: T0,
        weightDeclaredByBuyerAt: null,
        sellerShippedAt: null
      };
      expect(escrowDeadlineAt(tx)).toBeNull();
      expect(escrowTimeoutOutcomeKey(tx.status)).toBeNull();
    });

    it("PAYMENT_HELD (attente sans timeout) → aucune échéance", () => {
      const tx = {
        status: MarketplaceTransactionStatus.PAYMENT_HELD,
        offerExpiresAt: T0,
        weightDeclaredByBuyerAt: null,
        sellerShippedAt: null
      };
      expect(escrowDeadlineAt(tx)).toBeNull();
      expect(escrowTimeoutOutcomeKey(tx.status)).toBeNull();
    });
  });

  describe("commandes boutique", () => {
    it("paid → échéance = timeoutAt + remboursement", () => {
      const timeoutAt = new Date("2026-07-19T10:00:00.000Z");
      const order = {
        status: MerchantOrderStatus.paid,
        timeoutAt,
        deliveredAt: null
      };
      expect(shopDeadlineAt(order)).toEqual(timeoutAt);
      expect(shopTimeoutOutcomeKey(order.status)).toBe(
        DEADLINE_OUTCOME_KEY.shopConfirmRefund
      );
    });

    it("delivered → échéance = livraison + 48h + clôture (vendeur payé)", () => {
      const deliveredAt = new Date("2026-07-17T10:00:00.000Z");
      const order = {
        status: MerchantOrderStatus.delivered,
        timeoutAt: null,
        deliveredAt
      };
      expect(shopDeadlineAt(order)?.getTime()).toBe(
        deliveredAt.getTime() + MERCHANT_ORDER_DISPUTE_WINDOW_MS
      );
      expect(shopTimeoutOutcomeKey(order.status)).toBe(
        DEADLINE_OUTCOME_KEY.shopAutoComplete
      );
    });

    it("confirmed (pas de timeout) → aucune échéance", () => {
      const order = {
        status: MerchantOrderStatus.confirmed,
        timeoutAt: null,
        deliveredAt: null
      };
      expect(shopDeadlineAt(order)).toBeNull();
      expect(shopTimeoutOutcomeKey(order.status)).toBeNull();
    });
  });

  describe("crédit et offres", () => {
    it("solde crédit → conséquence arbitrage", () => {
      expect(creditBalanceTimeoutOutcomeKey()).toBe(
        DEADLINE_OUTCOME_KEY.creditBalanceArbitration
      );
    });

    it("offre pending/countered → expiration ; sinon null", () => {
      expect(offerProposalTimeoutOutcomeKey(OfferStatus.pending)).toBe(
        DEADLINE_OUTCOME_KEY.offerProposalExpire
      );
      expect(offerProposalTimeoutOutcomeKey(OfferStatus.countered)).toBe(
        DEADLINE_OUTCOME_KEY.offerProposalExpire
      );
      expect(offerProposalTimeoutOutcomeKey(OfferStatus.accepted)).toBeNull();
      expect(offerProposalTimeoutOutcomeKey(OfferStatus.rejected)).toBeNull();
    });
  });
});

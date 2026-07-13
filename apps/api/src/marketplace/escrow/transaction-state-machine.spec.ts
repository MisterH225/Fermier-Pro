import { MarketplaceTransactionStatus } from "@prisma/client";
import {
  canTransition,
  getAllowedTransitions,
  MARKETPLACE_TRANSACTION_EVENTS,
  TRANSACTION_TRANSITIONS,
  type MarketplaceTransactionEvent,
  type TransitionDefinition
} from "./transaction-state-machine";

const ALL_STATUSES = Object.values(MarketplaceTransactionStatus);

const LEGAL_BY_KEY = new Map<string, TransitionDefinition>();
for (const transition of TRANSACTION_TRANSITIONS) {
  LEGAL_BY_KEY.set(`${transition.from}::${transition.event}`, transition);
}

describe("transaction-state-machine", () => {
  describe("canTransition — transitions légales (table)", () => {
    it.each(TRANSACTION_TRANSITIONS)(
      "$from + $event → $to (actors: $actors)",
      ({ from, event, to }) => {
        expect(canTransition(from, event)).toEqual({
          allowed: true,
          to
        });
      }
    );
  });

  describe("canTransition — produit cartésien états × événements", () => {
    const cases: Array<{
      from: MarketplaceTransactionStatus;
      event: MarketplaceTransactionEvent;
      expectedAllowed: boolean;
      expectedTo: MarketplaceTransactionStatus | null;
    }> = [];

    for (const from of ALL_STATUSES) {
      for (const event of MARKETPLACE_TRANSACTION_EVENTS) {
        const legal = LEGAL_BY_KEY.get(`${from}::${event}`);
        cases.push({
          from,
          event,
          expectedAllowed: legal != null,
          expectedTo: legal?.to ?? null
        });
      }
    }

    it(`couvre ${ALL_STATUSES.length} × ${MARKETPLACE_TRANSACTION_EVENTS.length} = ${cases.length} paires`, () => {
      expect(cases).toHaveLength(
        ALL_STATUSES.length * MARKETPLACE_TRANSACTION_EVENTS.length
      );
    });

    it.each(cases)(
      "$from × $event → allowed=$expectedAllowed to=$expectedTo",
      ({ from, event, expectedAllowed, expectedTo }) => {
        expect(canTransition(from, event)).toEqual({
          allowed: expectedAllowed,
          to: expectedTo
        });
      }
    );
  });

  describe("invariants métier figés (garde-fous)", () => {
    it("refuse toute transition depuis les statuts terminaux classiques", () => {
      const terminals: MarketplaceTransactionStatus[] = [
        MarketplaceTransactionStatus.TRANSACTION_CLOSED,
        MarketplaceTransactionStatus.CANCELLED_BY_BUYER,
        MarketplaceTransactionStatus.CANCELLED_BY_SELLER,
        MarketplaceTransactionStatus.CANCELLED_SOLD_TO_OTHER,
        MarketplaceTransactionStatus.OFFER_EXPIRED
      ];
      for (const from of terminals) {
        for (const event of MARKETPLACE_TRANSACTION_EVENTS) {
          expect(canTransition(from, event).allowed).toBe(false);
        }
      }
    });

    it("PAYMENT_FAILED n'autorise que PAYMENT_RETRY", () => {
      const allowed = getAllowedTransitions(
        MarketplaceTransactionStatus.PAYMENT_FAILED
      );
      expect(allowed).toEqual([
        expect.objectContaining({
          event: "PAYMENT_RETRY",
          to: MarketplaceTransactionStatus.PAYMENT_PENDING
        })
      ]);
      for (const event of MARKETPLACE_TRANSACTION_EVENTS) {
        const result = canTransition(
          MarketplaceTransactionStatus.PAYMENT_FAILED,
          event
        );
        if (event === "PAYMENT_RETRY") {
          expect(result).toEqual({
            allowed: true,
            to: MarketplaceTransactionStatus.PAYMENT_PENDING
          });
        } else {
          expect(result.allowed).toBe(false);
        }
      }
    });

    it("OFFER_ACCEPTED n'a aucune transition (statut jamais écrit par le service)", () => {
      expect(
        getAllowedTransitions(MarketplaceTransactionStatus.OFFER_ACCEPTED)
      ).toEqual([]);
      for (const event of MARKETPLACE_TRANSACTION_EVENTS) {
        expect(
          canTransition(MarketplaceTransactionStatus.OFFER_ACCEPTED, event)
            .allowed
        ).toBe(false);
      }
    });

    it("aucun événement n'écrit OFFER_ACCEPTED", () => {
      const writingOfferAccepted = TRANSACTION_TRANSITIONS.filter(
        (t) => t.to === MarketplaceTransactionStatus.OFFER_ACCEPTED
      );
      expect(writingOfferAccepted).toEqual([]);
    });

    it("DELIVERY_DISPUTED : vendor win → BUYER_RECEIVED, autres issues → CANCELLED_BY_SELLER", () => {
      expect(
        canTransition(
          MarketplaceTransactionStatus.DELIVERY_DISPUTED,
          "DELIVERY_DISPUTE_VENDOR_WIN"
        )
      ).toEqual({
        allowed: true,
        to: MarketplaceTransactionStatus.BUYER_RECEIVED
      });
      for (const event of [
        "DELIVERY_DISPUTE_BUYER_WIN",
        "DELIVERY_DISPUTE_CANCELLED",
        "DELIVERY_DISPUTE_SPLIT"
      ] as const) {
        expect(
          canTransition(
            MarketplaceTransactionStatus.DELIVERY_DISPUTED,
            event
          )
        ).toEqual({
          allowed: true,
          to: MarketplaceTransactionStatus.CANCELLED_BY_SELLER
        });
      }
    });

    it("ne permet pas BUYER_CANCEL / SELLER_CANCEL depuis litiges ou BUYER_RECEIVED", () => {
      const blocked: MarketplaceTransactionStatus[] = [
        MarketplaceTransactionStatus.DELIVERY_DISPUTED,
        MarketplaceTransactionStatus.WEIGHT_DISPUTED,
        MarketplaceTransactionStatus.BUYER_RECEIVED
      ];
      for (const from of blocked) {
        expect(canTransition(from, "BUYER_CANCEL").allowed).toBe(false);
        expect(canTransition(from, "SELLER_CANCEL").allowed).toBe(false);
      }
    });

    it("chaque entrée de TRANSACTION_TRANSITIONS a une clé (from, event) unique", () => {
      const keys = TRANSACTION_TRANSITIONS.map((t) => `${t.from}::${t.event}`);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});

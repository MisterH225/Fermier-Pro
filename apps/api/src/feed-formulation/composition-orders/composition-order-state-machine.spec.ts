import { CompositionOrderStatus } from "@prisma/client";
import {
  canCancelCompositionOrderWithoutRefund,
  canTransitionCompositionOrder,
  COMPOSITION_ORDER_EVENTS,
  COMPOSITION_ORDER_TRANSITIONS,
  getAllowedCompositionOrderTransitions,
  isCompositionOrderPastPointOfNoReturn,
  type CompositionOrderEvent,
  type CompositionOrderTransitionDefinition
} from "./composition-order-state-machine";

const ALL_STATUSES = Object.values(CompositionOrderStatus);

const LEGAL_BY_KEY = new Map<string, CompositionOrderTransitionDefinition>();
for (const t of COMPOSITION_ORDER_TRANSITIONS) {
  LEGAL_BY_KEY.set(`${t.from}::${t.event}`, t);
}

describe("composition-order-state-machine", () => {
  describe("transitions légales (table)", () => {
    it.each(COMPOSITION_ORDER_TRANSITIONS)(
      "$from + $event → $to (actors: $actors)",
      ({ from, event, to }) => {
        expect(canTransitionCompositionOrder(from, event)).toEqual({
          allowed: true,
          to
        });
      }
    );
  });

  describe("produit cartésien états × événements", () => {
    const cases: Array<{
      from: CompositionOrderStatus;
      event: CompositionOrderEvent;
      expectedAllowed: boolean;
      expectedTo: CompositionOrderStatus | null;
    }> = [];

    for (const from of ALL_STATUSES) {
      for (const event of COMPOSITION_ORDER_EVENTS) {
        const legal = LEGAL_BY_KEY.get(`${from}::${event}`);
        cases.push({
          from,
          event,
          expectedAllowed: legal != null,
          expectedTo: legal?.to ?? null
        });
      }
    }

    it(`couvre ${ALL_STATUSES.length} × ${COMPOSITION_ORDER_EVENTS.length} = ${cases.length} paires`, () => {
      expect(cases).toHaveLength(
        ALL_STATUSES.length * COMPOSITION_ORDER_EVENTS.length
      );
    });

    it.each(cases)(
      "$from × $event → allowed=$expectedAllowed to=$expectedTo",
      ({ from, event, expectedAllowed, expectedTo }) => {
        expect(canTransitionCompositionOrder(from, event)).toEqual({
          allowed: expectedAllowed,
          to: expectedTo
        });
      }
    );
  });

  describe("acteurs", () => {
    it("MILL_REVISE refusé au producteur", () => {
      expect(
        canTransitionCompositionOrder(
          CompositionOrderStatus.SENT_TO_MILL,
          "MILL_REVISE",
          "producer"
        ).allowed
      ).toBe(false);
    });

    it("PRODUCER_ACCEPT réservé au producteur", () => {
      expect(
        canTransitionCompositionOrder(
          CompositionOrderStatus.MILL_REVISED,
          "PRODUCER_ACCEPT",
          "mill"
        ).allowed
      ).toBe(false);
      expect(
        canTransitionCompositionOrder(
          CompositionOrderStatus.MILL_REVISED,
          "PRODUCER_ACCEPT",
          "producer"
        )
      ).toEqual({ allowed: true, to: CompositionOrderStatus.ACCEPTED });
    });
  });

  describe("invariants métier", () => {
    it("pas d'annulation libre après IN_PRODUCTION", () => {
      for (const from of [
        CompositionOrderStatus.IN_PRODUCTION,
        CompositionOrderStatus.READY_FOR_PICKUP,
        CompositionOrderStatus.PAID
      ]) {
        expect(
          canTransitionCompositionOrder(from, "PRODUCER_CANCEL").allowed
        ).toBe(false);
      }
      expect(isCompositionOrderPastPointOfNoReturn(
        CompositionOrderStatus.IN_PRODUCTION
      )).toBe(true);
      expect(
        canCancelCompositionOrderWithoutRefund(
          CompositionOrderStatus.SENT_TO_MILL
        )
      ).toBe(true);
      expect(
        canCancelCompositionOrderWithoutRefund(
          CompositionOrderStatus.IN_PRODUCTION
        )
      ).toBe(false);
    });

    it("terminaux REJECTED / CANCELLED / COMPLETED sans sortie", () => {
      for (const from of [
        CompositionOrderStatus.REJECTED,
        CompositionOrderStatus.CANCELLED,
        CompositionOrderStatus.COMPLETED
      ]) {
        expect(getAllowedCompositionOrderTransitions(from)).toEqual([]);
      }
    });
  });
});

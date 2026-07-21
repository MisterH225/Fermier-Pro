import { VetAppointmentStatus } from "@prisma/client";
import {
  canTransition,
  getAllowedTransitions,
  TERMINAL_VET_APPOINTMENT_STATUSES,
  VET_APPOINTMENT_EVENTS,
  VET_APPOINTMENT_TRANSITIONS,
  type VetAppointmentEvent,
  type VetAppointmentTransitionDefinition
} from "./vet-appointment-state-machine";

const ALL_STATUSES = Object.values(VetAppointmentStatus);

const LEGAL_BY_KEY = new Map<string, VetAppointmentTransitionDefinition>();
for (const transition of VET_APPOINTMENT_TRANSITIONS) {
  LEGAL_BY_KEY.set(`${transition.from}::${transition.event}`, transition);
}

describe("vet-appointment-state-machine", () => {
  describe("transitions légales", () => {
    it.each(VET_APPOINTMENT_TRANSITIONS)(
      "$from + $event → $to",
      ({ from, event, to }) => {
        expect(canTransition(from, event)).toEqual({
          allowed: true,
          to
        });
      }
    );
  });

  describe("produit cartésien — transitions interdites rejetées", () => {
    const cases: Array<{
      from: VetAppointmentStatus;
      event: VetAppointmentEvent;
      expectedAllowed: boolean;
      expectedTo: VetAppointmentStatus | null;
    }> = [];

    for (const from of ALL_STATUSES) {
      for (const event of VET_APPOINTMENT_EVENTS) {
        const legal = LEGAL_BY_KEY.get(`${from}::${event}`);
        cases.push({
          from,
          event,
          expectedAllowed: legal != null,
          expectedTo: legal?.to ?? null
        });
      }
    }

    it(`couvre ${ALL_STATUSES.length} × ${VET_APPOINTMENT_EVENTS.length} paires`, () => {
      expect(cases).toHaveLength(
        ALL_STATUSES.length * VET_APPOINTMENT_EVENTS.length
      );
    });

    it.each(cases)(
      "$from × $event → allowed=$expectedAllowed",
      ({ from, event, expectedAllowed, expectedTo }) => {
        expect(canTransition(from, event)).toEqual({
          allowed: expectedAllowed,
          to: expectedTo
        });
      }
    );
  });

  describe("invariants métier", () => {
    it("refuse toute transition depuis les statuts terminaux", () => {
      for (const from of TERMINAL_VET_APPOINTMENT_STATUSES) {
        for (const event of VET_APPOINTMENT_EVENTS) {
          expect(canTransition(from, event).allowed).toBe(false);
        }
      }
    });

    it("proposition vétérinaire : accept gratuit → confirmé, payant → paiement", () => {
      expect(
        canTransition(VetAppointmentStatus.VISIT_PROPOSED, "PRODUCER_ACCEPT_FREE")
      ).toEqual({
        allowed: true,
        to: VetAppointmentStatus.APPOINTMENT_CONFIRMED
      });
      expect(
        canTransition(VetAppointmentStatus.VISIT_PROPOSED, "PRODUCER_ACCEPT_PAID")
      ).toEqual({
        allowed: true,
        to: VetAppointmentStatus.AWAITING_PAYMENT
      });
    });

    it("refuse le paiement sans acceptation producteur (VISIT_PROPOSED)", () => {
      expect(
        canTransition(VetAppointmentStatus.VISIT_PROPOSED, "PAYMENT_CONFIRMED")
          .allowed
      ).toBe(false);
    });

    it("producteur peut refuser montant en AWAITING_PAYMENT", () => {
      expect(
        canTransition(VetAppointmentStatus.AWAITING_PAYMENT, "PRODUCER_REFUSE")
      ).toEqual({
        allowed: true,
        to: VetAppointmentStatus.REFUSED_BY_PRODUCER
      });
    });

    it("getAllowedTransitions ne renvoie que les arcs sortants", () => {
      const from = VetAppointmentStatus.VISIT_PROPOSED;
      const allowed = getAllowedTransitions(from);
      expect(allowed.every((t) => t.from === from)).toBe(true);
      expect(allowed.length).toBeGreaterThan(0);
    });
  });
});
